#!/bin/bash

# TRIXTECH Backup Retention Script
# Removes backups older than specified days
# Maintains minimum number of backups
# Logs all cleanup actions

set -e  # Exit on any error

# Configuration from environment variables
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
MIN_BACKUPS="${MIN_BACKUPS:-5}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [CLEANUP] $1" | tee -a "$LOG_FILE"
}

# Alert function for monitoring integration
alert() {
    local message="$1"
    local level="${2:-info}"
    log "ALERT: $message"
    # Send alert to monitoring system if URL is set
    if [ -n "$MONITORING_URL" ]; then
        curl -s -X POST "$MONITORING_URL" \
            -H "Content-Type: application/json" \
            -d "{\"message\":\"Backup Cleanup: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to get backup files sorted by modification time (newest first)
get_backup_files() {
    local backup_type="$1"
    find "$BACKUP_DIR" -name "${backup_type}_backup_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -nr | cut -d' ' -f2-
}

# Function to cleanup backups for a specific type
cleanup_backups() {
    local backup_type="$1"
    log "Starting cleanup for $backup_type backups"

    # Get all backup files sorted by age (newest first)
    local backup_files=($(get_backup_files "$backup_type"))

    if [ ${#backup_files[@]} -eq 0 ]; then
        log "No $backup_type backup files found"
        return
    fi

    log "Found ${#backup_files[@]} $backup_type backup files"

    # Keep minimum number of backups regardless of age
    local files_to_check=("${backup_files[@]:$MIN_BACKUPS}")

    if [ ${#files_to_check[@]} -eq 0 ]; then
        log "Keeping all ${#backup_files[@]} $backup_type backups (minimum requirement: $MIN_BACKUPS)"
        return
    fi

    # Check age of remaining files
    local deleted_count=0
    local current_time=$(date +%s)

    for backup_file in "${files_to_check[@]}"; do
        if [ -f "$backup_file" ]; then
            local file_age_days=$(( (current_time - $(stat -c %Y "$backup_file")) / 86400 ))

            if [ $file_age_days -gt $RETENTION_DAYS ]; then
                local file_size=$(du -sh "$backup_file" | cut -f1)
                if rm "$backup_file"; then
                    log "Deleted old $backup_type backup: $(basename "$backup_file") (age: ${file_age_days} days, size: $file_size)"
                    ((deleted_count++))
                else
                    alert "Failed to delete $backup_file"
                fi
            fi
        fi
    done

    if [ $deleted_count -gt 0 ]; then
        alert "Cleanup completed: Deleted $deleted_count old $backup_type backups" "info"
    else
        log "No old $backup_type backups to delete"
    fi
}

# Function to show current backup status
show_status() {
    log "=== Backup Retention Status ==="

    for backup_type in "db" "file"; do
        local backup_files=($(get_backup_files "$backup_type"))
        local total_size=0

        log "$backup_type backups: ${#backup_files[@]} files"

        for backup_file in "${backup_files[@]}"; do
            if [ -f "$backup_file" ]; then
                local size=$(stat -c %s "$backup_file")
                total_size=$((total_size + size))
            fi
        done

        local human_size=$(numfmt --to=iec-i --suffix=B $total_size 2>/dev/null || echo "${total_size}B")
        log "  Total size: $human_size"
    done

    log "Retention policy: Keep minimum $MIN_BACKUPS backups, delete older than $RETENTION_DAYS days"
}

# Main execution
main() {
    log "=== Backup Cleanup Started ==="

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Backup directory $BACKUP_DIR does not exist"
        exit 0
    fi

    show_status

    # Cleanup database backups
    cleanup_backups "db"

    # Cleanup file system backups
    cleanup_backups "file"

    show_status

    log "=== Backup Cleanup Completed ==="
}

# Run main function
main "$@"