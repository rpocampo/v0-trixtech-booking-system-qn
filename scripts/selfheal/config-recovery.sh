#!/bin/bash

# TRIXTECH Booking System - Configuration Recovery
# Backs up configurations before changes, validates config files on service start,
# rolls back to last known good configuration, and alerts on validation failures.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/config-recovery.log"
BACKUP_DIR="${SCRIPT_DIR}/../backups/config"
MAX_BACKUPS=10
VALIDATION_TIMEOUT=30  # seconds
ALERT_EMAIL="admin@trixtech.com"

# Load environment-specific configuration
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    echo "[$timestamp] [$level] $message"
}

# Alert function
alert() {
    local message="$1"
    log "ALERT" "$message"
    # Integrate with monitoring system
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "TRIXTECH Config Recovery Alert" "$ALERT_EMAIL"
    fi
}

# Create backup of configuration
backup_config() {
    local config_file="$1"
    local service_name="$2"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/${service_name}/${timestamp}_$(basename "$config_file")"

    mkdir -p "${BACKUP_DIR}/${service_name}"

    if cp "$config_file" "$backup_file"; then
        log "INFO" "Configuration backed up: $config_file -> $backup_file"
        echo "$backup_file"
        return 0
    else
        log "ERROR" "Failed to backup configuration: $config_file"
        return 1
    fi
}

# Validate JSON configuration
validate_json_config() {
    local config_file="$1"

    if [[ ! -f "$config_file" ]]; then
        log "ERROR" "Configuration file does not exist: $config_file"
        return 1
    fi

    if command -v jq >/dev/null 2>&1; then
        if jq empty "$config_file" >/dev/null 2>&1; then
            log "INFO" "JSON validation passed for: $config_file"
            return 0
        else
            log "ERROR" "JSON validation failed for: $config_file"
            return 1
        fi
    else
        # Fallback: try to parse with python
        if python3 -m json.tool "$config_file" >/dev/null 2>&1; then
            log "INFO" "JSON validation passed for: $config_file"
            return 0
        else
            log "ERROR" "JSON validation failed for: $config_file"
            return 1
        fi
    fi
}

# Validate YAML configuration
validate_yaml_config() {
    local config_file="$1"

    if [[ ! -f "$config_file" ]]; then
        log "ERROR" "Configuration file does not exist: $config_file"
        return 1
    fi

    if command -v python3 >/dev/null 2>&1; then
        if python3 -c "import yaml; yaml.safe_load(open('$config_file'))" >/dev/null 2>&1; then
            log "INFO" "YAML validation passed for: $config_file"
            return 0
        else
            log "ERROR" "YAML validation failed for: $config_file"
            return 1
        fi
    else
        log "WARN" "Python not available for YAML validation"
        return 0  # Skip validation if no tool available
    fi
}

# Validate environment file
validate_env_config() {
    local config_file="$1"

    if [[ ! -f "$config_file" ]]; then
        log "ERROR" "Configuration file does not exist: $config_file"
        return 1
    fi

    # Basic validation: check for required variables
    local required_vars=("NODE_ENV" "DATABASE_URL" "JWT_SECRET")
    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$config_file"; then
            missing_vars+=("$var")
        fi
    done

    if (( ${#missing_vars[@]} > 0 )); then
        log "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi

    log "INFO" "Environment file validation passed for: $config_file"
    return 0
}

# Validate configuration file based on type
validate_config() {
    local config_file="$1"
    local config_type="$2"

    case "$config_type" in
        json)
            validate_json_config "$config_file"
            ;;
        yaml|yml)
            validate_yaml_config "$config_file"
            ;;
        env)
            validate_env_config "$config_file"
            ;;
        *)
            log "WARN" "Unknown config type: $config_type, skipping validation"
            return 0
            ;;
    esac
}

# Rollback to last known good configuration
rollback_config() {
    local service_name="$1"
    local current_config="$2"
    local backup_dir="${BACKUP_DIR}/${service_name}"

    if [[ ! -d "$backup_dir" ]]; then
        log "ERROR" "No backups available for service: $service_name"
        return 1
    fi

    # Find the most recent backup
    local latest_backup=$(ls -t "$backup_dir" | head -1)

    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backup files found for service: $service_name"
        return 1
    fi

    local backup_file="${backup_dir}/${latest_backup}"

    log "INFO" "Rolling back $service_name config from $backup_file"

    if cp "$backup_file" "$current_config"; then
        log "INFO" "Configuration rolled back successfully for: $service_name"
        return 0
    else
        log "ERROR" "Failed to rollback configuration for: $service_name"
        return 1
    fi
}

# Validate service configuration before start
validate_service_config() {
    local service_name="$1"
    local config_files=("${@:2}")

    log "INFO" "Validating configuration for service: $service_name"

    local validation_failed=false

    for config_entry in "${config_files[@]}"; do
        IFS=':' read -r config_file config_type <<< "$config_entry"

        if [[ ! -f "$config_file" ]]; then
            log "WARN" "Configuration file not found: $config_file"
            continue
        fi

        # Backup before validation
        backup_config "$config_file" "$service_name"

        if ! validate_config "$config_file" "$config_type"; then
            validation_failed=true
            alert "Configuration validation failed for $service_name: $config_file"

            # Attempt rollback
            if rollback_config "$service_name" "$config_file"; then
                log "INFO" "Retrying validation after rollback"
                if validate_config "$config_file" "$config_type"; then
                    validation_failed=false
                    log "INFO" "Validation passed after rollback"
                fi
            fi
        fi
    done

    if $validation_failed; then
        return 1
    fi

    return 0
}

# Cleanup old backups
cleanup_backups() {
    for service_dir in "${BACKUP_DIR}"/*/; do
        if [[ -d "$service_dir" ]]; then
            local service_name=$(basename "$service_dir")
            local backup_count=$(ls -1 "$service_dir" | wc -l)

            if (( backup_count > MAX_BACKUPS )); then
                local to_remove=$(( backup_count - MAX_BACKUPS ))
                ls -t "$service_dir" | tail -n "$to_remove" | xargs -I {} rm -f "$service_dir/{}"
                log "INFO" "Cleaned up $to_remove old backups for $service_name"
            fi
        fi
    done
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/config-recovery.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping config recovery"
        return 0
    fi
    return 1
}

# Main function
main() {
    log "INFO" "Starting TRIXTECH Configuration Recovery"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"
    mkdir -p "$BACKUP_DIR"

    # Cleanup old backups
    cleanup_backups

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    # Define service configurations to validate
    # Format: "config_file:config_type"
    local backend_configs=(
        "${SCRIPT_DIR}/../../backend/.env:env"
        "${SCRIPT_DIR}/../../backend/package.json:json"
    )

    local frontend_configs=(
        "${SCRIPT_DIR}/../../frontend/.env:env"
        "${SCRIPT_DIR}/../../frontend/package.json:json"
        "${SCRIPT_DIR}/../../frontend/next.config.js:js"
    )

    local docker_configs=(
        "${SCRIPT_DIR}/../../docker-compose.yml:yaml"
    )

    # Validate configurations
    local validation_errors=0

    if ! validate_service_config "backend" "${backend_configs[@]}"; then
        ((validation_errors++))
    fi

    if ! validate_service_config "frontend" "${frontend_configs[@]}"; then
        ((validation_errors++))
    fi

    if ! validate_service_config "docker" "${docker_configs[@]}"; then
        ((validation_errors++))
    fi

    if (( validation_errors > 0 )); then
        alert "Configuration validation completed with $validation_errors errors"
        exit 1
    else
        log "INFO" "All configuration validations passed"
    fi
}

# Run main function
main "$@"