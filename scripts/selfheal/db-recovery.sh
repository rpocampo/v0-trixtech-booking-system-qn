#!/bin/bash

# TRIXTECH Booking System - Database Recovery
# Detects database connection failures, attempts reconnection with exponential backoff,
# restarts database service on persistent failure, and verifies integrity after recovery.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/db-recovery.log"
DB_CONTAINER="database"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-password}"
DB_NAME="${DB_NAME:-trixtech}"
MAX_RETRIES=5
INITIAL_BACKOFF=5  # seconds
MAX_BACKOFF=300    # 5 minutes
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
        echo "$message" | mail -s "TRIXTECH Database Recovery Alert" "$ALERT_EMAIL"
    fi
}

# Test database connection
test_db_connection() {
    local timeout=10
    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" --quiet --tuples-only --no-align --command-timeout="$timeout" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Restart database container
restart_database() {
    log "INFO" "Attempting to restart database container: $DB_CONTAINER"
    if docker restart "$DB_CONTAINER" >/dev/null 2>&1; then
        log "INFO" "Database container restarted successfully"
        # Wait for database to be ready
        sleep 30
        return 0
    else
        alert "Failed to restart database container: $DB_CONTAINER"
        return 1
    fi
}

# Verify database integrity
verify_db_integrity() {
    log "INFO" "Verifying database integrity"
    # Run basic integrity checks
    local queries=(
        "SELECT COUNT(*) FROM users;"
        "SELECT COUNT(*) FROM bookings;"
        "SELECT COUNT(*) FROM payments;"
    )

    for query in "${queries[@]}"; do
        if ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$query" --quiet --tuples-only --no-align >/dev/null 2>&1; then
            alert "Database integrity check failed for query: $query"
            return 1
        fi
    done

    log "INFO" "Database integrity verification passed"
    return 0
}

# Exponential backoff reconnection
reconnect_with_backoff() {
    local attempt=1
    local backoff="$INITIAL_BACKOFF"

    while (( attempt <= MAX_RETRIES )); do
        log "INFO" "Database reconnection attempt $attempt/$MAX_RETRIES"

        if test_db_connection; then
            log "INFO" "Database connection restored"
            return 0
        fi

        if (( attempt == MAX_RETRIES )); then
            log "WARN" "All reconnection attempts failed, attempting container restart"
            if restart_database && test_db_connection; then
                log "INFO" "Database recovered after container restart"
                verify_db_integrity
                return 0
            else
                alert "Database recovery failed after container restart"
                return 1
            fi
        fi

        log "WARN" "Database connection failed, retrying in $backoff seconds"
        sleep "$backoff"

        # Exponential backoff with cap
        backoff=$(( backoff * 2 ))
        if (( backoff > MAX_BACKOFF )); then
            backoff="$MAX_BACKOFF"
        fi

        ((attempt++))
    done

    return 1
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        alert "Docker daemon is not running, cannot recover database"
        return 1
    fi
    return 0
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/db-recovery.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping database recovery"
        return 0
    fi
    return 1
}

# Cleanup old logs
cleanup_logs() {
    # Keep logs for 30 days
    find "${SCRIPT_DIR}/../logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
}

# Main function
main() {
    log "INFO" "Starting TRIXTECH Database Recovery"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"

    # Cleanup old logs
    cleanup_logs

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    # Check Docker
    if ! check_docker; then
        exit 1
    fi

    # Test initial connection
    if test_db_connection; then
        log "INFO" "Database connection is healthy"
        exit 0
    fi

    # Attempt recovery
    if reconnect_with_backoff; then
        log "INFO" "Database recovery completed successfully"
    else
        alert "Database recovery failed"
        exit 1
    fi
}

# Run main function
main "$@"