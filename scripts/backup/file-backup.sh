#!/bin/bash

# TRIXTECH File System Backup Script
# Backs up uploads directory and configuration files
# Excludes sensitive data and temporary files
# Creates compressed archives

set -e  # Exit on any error

# Configuration from environment variables
SOURCE_DIRS="${SOURCE_DIRS:-/app/frontend/public/uploads /app/backend/config /app/backend/uploads}"
BACKUP_DIR="${BACKUP_DIR:-/backups/filesystem}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"
EXCLUDE_PATTERNS="${EXCLUDE_PATTERNS:-*.log *.tmp node_modules .git .env* *.key *.pem}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Timestamp for backup
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="file_backup_${TIMESTAMP}"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME.tar.gz"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [FILE-BACKUP] $1" | tee -a "$LOG_FILE"
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
            -d "{\"message\":\"File System Backup: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to build exclude options for tar
build_exclude_options() {
    local excludes=""
    for pattern in $EXCLUDE_PATTERNS; do
        excludes="$excludes --exclude='$pattern'"
    done
    echo "$excludes"
}

# Function to perform file system backup
perform_backup() {
    log "Starting file system backup: $BACKUP_NAME"

    # Build exclude options
    EXCLUDE_OPTS=$(build_exclude_options)

    # Create temporary directory for staging
    TEMP_DIR=$(mktemp -d)
    trap "rm -rf $TEMP_DIR" EXIT

    # Copy source directories to temp, applying excludes
    for src_dir in $SOURCE_DIRS; do
        if [ -d "$src_dir" ]; then
            local base_name=$(basename "$src_dir")
            local dest_dir="$TEMP_DIR/$base_name"
            mkdir -p "$dest_dir"

            # Use rsync to copy with excludes
            if rsync -a --exclude-from=<(echo "$EXCLUDE_PATTERNS" | tr ' ' '\n') "$src_dir/" "$dest_dir/"; then
                log "Copied $src_dir to staging area"
            else
                log "Warning: Failed to copy $src_dir"
            fi
        else
            log "Warning: Source directory $src_dir does not exist"
        fi
    done

    # Create compressed archive
    if tar -czf "$BACKUP_PATH" -C "$TEMP_DIR" .; then
        log "File system backup compressed successfully: $BACKUP_PATH"
    else
        alert "File system backup compression failed"
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
    if tar -tzf "$BACKUP_PATH" > /dev/null; then
        log "Backup archive integrity check passed"
    else
        alert "Backup archive integrity check failed"
        exit 1
    fi

    # Extract to verify contents
    if tar -xzf "$BACKUP_PATH" -C "$VERIFY_DIR"; then
        log "Backup extraction successful"

        # Check if expected directories exist
        local missing_dirs=""
        for src_dir in $SOURCE_DIRS; do
            local base_name=$(basename "$src_dir")
            if [ ! -d "$VERIFY_DIR/$base_name" ]; then
                missing_dirs="$missing_dirs $base_name"
            fi
        done

        if [ -n "$missing_dirs" ]; then
            alert "Backup verification failed: Missing directories:$missing_dirs"
            exit 1
        fi
    else
        alert "Backup extraction failed during verification"
        exit 1
    fi

    # Clean up verification directory
    rm -rf "$VERIFY_DIR"
    trap - EXIT

    log "Backup verification completed successfully"
}

# Main execution
main() {
    log "=== File System Backup Started ==="

    perform_backup
    verify_backup

    # Calculate backup size
    BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
    log "Backup completed successfully. Size: $BACKUP_SIZE"
    log "Backup location: $BACKUP_PATH"

    alert "File system backup completed successfully" "info"

    log "=== File System Backup Completed ==="
}

# Run main function
main "$@"