#!/bin/bash

# TRIXTECH Database Backup Script
# Supports MongoDB local and Atlas connections
# Creates compressed backups with timestamps
# Includes backup verification via restore test

set -e  # Exit on any error

# Configuration from environment variables
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/trixtech}"
BACKUP_DIR="${BACKUP_DIR:-/backups/database}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="db_backup_${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [DB-BACKUP] $1" | tee -a "$LOG_FILE"
}

# Alert function for monitoring integration
alert() {
    local message="$1"
    local level="${2:-error}"
    log "ALERT: $message"
    # Send alert to monitoring system if URL is set
    if [ -n "$MONITORING_URL" ]; then
        curl -s -X POST "$MONITORING_URL" \
            -H "Content-Type: application/json" \
            -d "{\"message\":\"Database Backup: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to perform backup
perform_backup() {
    log "Starting database backup: $BACKUP_NAME"

    # Create temporary directory for backup
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    # Run mongodump
    if mongodump --uri="$MONGO_URI" --out="$TEMP_DIR" --gzip; then
        log "Mongodump completed successfully"
    else
        alert "Mongodump failed"
        exit 1
    fi

    # Compress the backup
    if tar -czf "${BACKUP_PATH}.tar.gz" -C "$TEMP_DIR" .; then
        log "Backup compressed successfully: ${BACKUP_PATH}.tar.gz"
    else
        alert "Backup compression failed"
        exit 1
    fi

    # Clean up temp directory
    rm -rf "$TEMP_DIR"
    trap - EXIT
}

# Function to verify backup
verify_backup() {
    log "Starting backup verification"

    # Create temporary directory for verification
    VERIFY_DIR=$(mktemp -d)
    trap "rm -rf $VERIFY_DIR" EXIT

    # Extract backup
    if tar -xzf "${BACKUP_PATH}.tar.gz" -C "$VERIFY_DIR"; then
        log "Backup extraction successful"
    else
        alert "Backup extraction failed during verification"
        exit 1
    fi

    # Test restore to a temporary database
    TEST_DB="trixtech_backup_test_${TIMESTAMP}"
    if mongorestore --uri="$MONGO_URI" --db="$TEST_DB" --drop "$VERIFY_DIR"; then
        log "Backup restoration test successful"

        # Clean up test database
        mongo "$MONGO_URI" --eval "db.getSiblingDB('$TEST_DB').dropDatabase()"
    else
        alert "Backup restoration test failed"
        exit 1
    fi

    # Clean up verification directory
    rm -rf "$VERIFY_DIR"
    trap - EXIT

    log "Backup verification completed successfully"
}

# Main execution
main() {
    log "=== Database Backup Started ==="

    perform_backup
    verify_backup

    # Calculate backup size
    BACKUP_SIZE=$(du -sh "${BACKUP_PATH}.tar.gz" | cut -f1)
    log "Backup completed successfully. Size: $BACKUP_SIZE"
    log "Backup location: ${BACKUP_PATH}.tar.gz"

    alert "Database backup completed successfully" "info"

    log "=== Database Backup Completed ==="
}

# Run main function
main "$@"