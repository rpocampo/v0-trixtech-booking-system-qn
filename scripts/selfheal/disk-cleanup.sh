#!/bin/bash

# TRIXTECH Booking System - Disk Space Management
# Monitors disk usage, cleans temporary files and logs, removes old Docker images/containers,
# and alerts when manual intervention is needed.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/disk-cleanup.log"
DISK_THRESHOLD=85  # percentage
TEMP_FILE_AGE=7    # days
LOG_RETENTION=30   # days
DOCKER_CLEANUP_INTERVAL=7  # days
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
        echo "$message" | mail -s "TRIXTECH Disk Cleanup Alert" "$ALERT_EMAIL"
    fi
}

# Get disk usage percentage
get_disk_usage() {
    local mount_point="$1"
    df "$mount_point" --output=pcent | tail -1 | tr -d '% '
}

# Clean temporary files
clean_temp_files() {
    log "INFO" "Cleaning temporary files older than $TEMP_FILE_AGE days"

    local cleaned=0

    # System temp directories
    for dir in /tmp /var/tmp /var/log; do
        if [[ -d "$dir" ]]; then
            local count=$(find "$dir" -type f -mtime +"$TEMP_FILE_AGE" -print -delete 2>/dev/null | wc -l)
            cleaned=$(( cleaned + count ))
        fi
    done

    # Application specific temp files
    if [[ -d "${SCRIPT_DIR}/../../backend/tmp" ]]; then
        local count=$(find "${SCRIPT_DIR}/../../backend/tmp" -type f -mtime +"$TEMP_FILE_AGE" -print -delete 2>/dev/null | wc -l)
        cleaned=$(( cleaned + count ))
    fi

    log "INFO" "Cleaned $cleaned temporary files"
    echo "$cleaned"
}

# Clean old logs
clean_old_logs() {
    log "INFO" "Cleaning logs older than $LOG_RETENTION days"

    local cleaned=0

    # Application logs
    for log_dir in "${SCRIPT_DIR}/../logs" "${SCRIPT_DIR}/../../backend/logs" "${SCRIPT_DIR}/../../frontend/logs"; do
        if [[ -d "$log_dir" ]]; then
            local count=$(find "$log_dir" -name "*.log" -mtime +"$LOG_RETENTION" -print -delete 2>/dev/null | wc -l)
            cleaned=$(( cleaned + count ))
        fi
    done

    log "INFO" "Cleaned $cleaned old log files"
    echo "$cleaned"
}

# Clean Docker resources
clean_docker_resources() {
    log "INFO" "Performing Docker cleanup"

    if ! docker info >/dev/null 2>&1; then
        log "WARN" "Docker daemon not running, skipping Docker cleanup"
        return 0
    fi

    # Remove stopped containers older than 24 hours
    local stopped_containers=$(docker container ls -a --filter "status=exited" --filter "status=created" --format "{{.ID}} {{.CreatedAt}}" | awk '$2 <= "'$(date -d '24 hours ago' +%Y-%m-%dT%H:%M:%S)'" {print $1}' | wc -l)
    if (( stopped_containers > 0 )); then
        docker container prune -f >/dev/null 2>&1
        log "INFO" "Removed $stopped_containers stopped containers"
    fi

    # Remove dangling images
    local dangling_images=$(docker images -f "dangling=true" -q | wc -l)
    if (( dangling_images > 0 )); then
        docker image prune -f >/dev/null 2>&1
        log "INFO" "Removed $dangling_images dangling images"
    fi

    # Remove unused volumes (be careful)
    local unused_volumes=$(docker volume ls -qf "dangling=true" | wc -l)
    if (( unused_volumes > 0 )); then
        docker volume prune -f >/dev/null 2>&1
        log "INFO" "Removed $unused_volumes unused volumes"
    fi

    # Full system prune only once a week
    if [[ $(date +%u) -eq 7 ]]; then
        log "INFO" "Performing full Docker system cleanup"
        docker system prune -f >/dev/null 2>&1
    fi
}

# Monitor disk usage
monitor_disk_usage() {
    local mount_points=("/" "/var" "/opt" "/home")
    local critical_mounts=()

    for mount in "${mount_points[@]}"; do
        if [[ -d "$mount" ]]; then
            local usage=$(get_disk_usage "$mount")
            log "INFO" "Disk usage for $mount: ${usage}%"

            if (( usage > DISK_THRESHOLD )); then
                critical_mounts+=("$mount (${usage}%)")
            fi
        fi
    done

    if (( ${#critical_mounts[@]} > 0 )); then
        alert "Critical disk usage detected: ${critical_mounts[*]}"
        return 1
    fi

    return 0
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/disk-cleanup.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping disk cleanup"
        return 0
    fi
    return 1
}

# Main function
main() {
    log "INFO" "Starting TRIXTECH Disk Cleanup"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    # Monitor disk usage
    if ! monitor_disk_usage; then
        log "WARN" "High disk usage detected, proceeding with cleanup"
    fi

    # Perform cleanup
    local temp_cleaned=$(clean_temp_files)
    local logs_cleaned=$(clean_old_logs)
    clean_docker_resources

    # Check disk usage again
    if monitor_disk_usage; then
        log "INFO" "Disk cleanup completed successfully. Cleaned $temp_cleaned temp files and $logs_cleaned log files."
    else
        alert "Disk usage still critical after cleanup - manual intervention required"
    fi
}

# Run main function
main "$@"