#!/bin/bash

# TRIXTECH Restoration Procedures Script
# Supports point-in-time restoration
# Handles database and file system restoration
# Includes safety checks and confirmations

set -e  # Exit on any error

# Configuration from environment variables
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/trixtech}"
RESTORE_CONFIRMATION="${RESTORE_CONFIRMATION:-required}"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [RESTORE] $1" | tee -a "$LOG_FILE"
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
            -d "{\"message\":\"System Restore: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to get available backups
list_backups() {
    local backup_type="$1"
    echo "Available $backup_type backups:"
    find "$BACKUP_DIR" -name "${backup_type}_backup_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -10 | while read -r line; do
        local timestamp=$(echo "$line" | cut -d' ' -f1)
        local filepath=$(echo "$line" | cut -d' ' -f2-)
        local filename=$(basename "$filepath")
        local date=$(date -d "@$timestamp" +"%Y-%m-%d %H:%M:%S")
        local size=$(du -sh "$filepath" | cut -f1)
        echo "  $filename - $date - $size"
    done
}

# Function to confirm restoration
confirm_restore() {
    local action="$1"
    local backup_name="$2"

    if [ "$RESTORE_CONFIRMATION" = "disabled" ]; then
        log "Restore confirmation disabled, proceeding..."
        return 0
    fi

    echo "WARNING: This will $action using backup: $backup_name"
    echo "This operation may overwrite existing data and cannot be easily undone."
    read -p "Are you sure you want to continue? (type 'YES' to confirm): " confirmation

    if [ "$confirmation" != "YES" ]; then
        echo "Restore cancelled by user"
        exit 0
    fi

    log "Restore confirmed by user"
}

# Function to restore database
restore_database() {
    local backup_file="$1"
    local backup_name=$(basename "$backup_file" .tar.gz)

    log "Starting database restoration from: $backup_name"

    # Safety check: verify backup exists and is valid
    if [ ! -f "$backup_file" ]; then
        alert "Database backup file not found: $backup_file"
        exit 1
    fi

    # Confirm restoration
    confirm_restore "restore the database" "$backup_name"

    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Extract backup
    log "Extracting database backup..."
    if ! tar -xzf "$backup_file" -C "$temp_dir"; then
        alert "Failed to extract database backup"
        exit 1
    fi

    # Perform database restoration
    log "Restoring database..."
    if mongorestore --uri="$MONGO_URI" --drop --dir="$temp_dir"; then
        log "Database restoration completed successfully"
        alert "Database restored from $backup_name" "warning"
    else
        alert "Database restoration failed"
        exit 1
    fi

    # Clean up
    rm -rf "$temp_dir"
    trap - EXIT
}

# Function to restore file system
restore_filesystem() {
    local backup_file="$1"
    local target_dir="${2:-/app}"
    local backup_name=$(basename "$backup_file" .tar.gz)

    log "Starting file system restoration from: $backup_name to $target_dir"

    # Safety check: verify backup exists and is valid
    if [ ! -f "$backup_file" ]; then
        alert "File system backup file not found: $backup_file"
        exit 1
    fi

    # Confirm restoration
    confirm_restore "restore the file system to $target_dir" "$backup_name"

    # Create backup of current state (optional safety measure)
    local current_backup="/tmp/pre_restore_backup_$(date +%s).tar.gz"
    log "Creating safety backup of current state..."
    if tar -czf "$current_backup" -C "$target_dir" . 2>/dev/null; then
        log "Safety backup created: $current_backup"
    else
        log "Warning: Could not create safety backup"
    fi

    # Extract backup
    log "Restoring file system..."
    if tar -xzf "$backup_file" -C "$target_dir"; then
        log "File system restoration completed successfully"
        alert "File system restored from $backup_name to $target_dir" "warning"
    else
        alert "File system restoration failed"
        exit 1
    fi
}

# Function to perform point-in-time restoration
restore_point_in_time() {
    local timestamp="$1"
    local restore_type="${2:-both}"  # db, files, or both

    log "Starting point-in-time restoration for timestamp: $timestamp"

    # Find the closest backups before the specified timestamp
    local db_backup=""
    local file_backup=""

    if [ "$restore_type" = "db" ] || [ "$restore_type" = "both" ]; then
        db_backup=$(find "$BACKUP_DIR" -name "db_backup_*.tar.gz" -type f -newermt "@$timestamp" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        if [ -n "$db_backup" ]; then
            log "Found database backup: $(basename "$db_backup")"
        else
            alert "No suitable database backup found for timestamp $timestamp"
            exit 1
        fi
    fi

    if [ "$restore_type" = "files" ] || [ "$restore_type" = "both" ]; then
        file_backup=$(find "$BACKUP_DIR" -name "file_backup_*.tar.gz" -type f -newermt "@$timestamp" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
        if [ -n "$file_backup" ]; then
            log "Found file system backup: $(basename "$file_backup")"
        else
            alert "No suitable file system backup found for timestamp $timestamp"
            exit 1
        fi
    fi

    # Perform restorations
    if [ -n "$db_backup" ]; then
        restore_database "$db_backup"
    fi

    if [ -n "$file_backup" ]; then
        restore_filesystem "$file_backup"
    fi

    alert "Point-in-time restoration completed for timestamp $timestamp" "warning"
}

# Function to show restoration options
show_help() {
    echo "TRIXTECH System Restoration Script"
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --list-db          List available database backups"
    echo "  --list-files       List available file system backups"
    echo "  --restore-db FILE  Restore database from specific backup file"
    echo "  --restore-files FILE [TARGET_DIR]  Restore file system from backup"
    echo "  --point-in-time TIMESTAMP [TYPE]   Restore to specific timestamp (TYPE: db/files/both)"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list-db"
    echo "  $0 --restore-db /backups/db_backup_20231201_020000.tar.gz"
    echo "  $0 --point-in-time 2023-12-01T02:00:00 both"
    echo ""
    echo "Note: Restoration requires confirmation unless RESTORE_CONFIRMATION=disabled"
}

# Main execution
main() {
    log "=== System Restoration Started ==="

    case "${1:-}" in
        --list-db)
            list_backups "db"
            ;;
        --list-files)
            list_backups "file"
            ;;
        --restore-db)
            if [ -z "$2" ]; then
                echo "Error: Backup file required for --restore-db"
                exit 1
            fi
            restore_database "$2"
            ;;
        --restore-files)
            if [ -z "$2" ]; then
                echo "Error: Backup file required for --restore-files"
                exit 1
            fi
            restore_filesystem "$2" "$3"
            ;;
        --point-in-time)
            if [ -z "$2" ]; then
                echo "Error: Timestamp required for --point-in-time"
                exit 1
            fi
            # Convert ISO timestamp to Unix timestamp if needed
            local timestamp
            if [[ "$2" =~ ^[0-9]+$ ]]; then
                timestamp="$2"
            else
                timestamp=$(date -d "$2" +%s 2>/dev/null || echo "")
                if [ -z "$timestamp" ]; then
                    echo "Error: Invalid timestamp format. Use Unix timestamp or ISO format."
                    exit 1
                fi
            fi
            restore_point_in_time "$timestamp" "$3"
            ;;
        --help|*)
            show_help
            ;;
    esac

    log "=== System Restoration Completed ==="
}

# Run main function
main "$@"