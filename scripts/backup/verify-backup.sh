#!/bin/bash

# TRIXTECH Backup Verification Script
# Performs integrity checks on backup files
# Tests restoration capabilities
# Generates verification reports

set -e  # Exit on any error

# Configuration from environment variables
BACKUP_DIR="${BACKUP_DIR:-/backups}"
REPORT_DIR="${REPORT_DIR:-/reports}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"
MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/trixtech}"

# Create directories if they don't exist
mkdir -p "$REPORT_DIR"

# Timestamp for report
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/verification_report_${TIMESTAMP}.txt"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [VERIFY] $1" | tee -a "$LOG_FILE"
}

# Report function
report() {
    echo "$1" | tee -a "$REPORT_FILE"
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
            -d "{\"message\":\"Backup Verification: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to verify database backup
verify_db_backup() {
    local backup_file="$1"
    local backup_name=$(basename "$backup_file" .tar.gz)

    report "=== Verifying Database Backup: $backup_name ==="

    # Check file integrity
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        report "✓ Archive integrity check passed"
    else
        report "✗ Archive integrity check failed"
        return 1
    fi

    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" RETURN

    # Extract backup
    if tar -xzf "$backup_file" -C "$temp_dir"; then
        report "✓ Backup extraction successful"
    else
        report "✗ Backup extraction failed"
        return 1
    fi

    # Test database restoration
    local test_db="trixtech_verify_${TIMESTAMP}"
    if mongorestore --uri="$MONGO_URI" --db="$test_db" --drop "$temp_dir" > /dev/null 2>&1; then
        report "✓ Database restoration test passed"

        # Get some stats from test database
        local collections=$(mongo "$MONGO_URI" --eval "db.getSiblingDB('$test_db').getCollectionNames().length" --quiet 2>/dev/null || echo "N/A")
        report "  Collections in backup: $collections"

        # Clean up test database
        mongo "$MONGO_URI" --eval "db.getSiblingDB('$test_db').dropDatabase()" --quiet > /dev/null 2>&1
    else
        report "✗ Database restoration test failed"
        return 1
    fi

    report "✓ Database backup verification completed successfully"
    return 0
}

# Function to verify file system backup
verify_file_backup() {
    local backup_file="$1"
    local backup_name=$(basename "$backup_file" .tar.gz)

    report "=== Verifying File System Backup: $backup_name ==="

    # Check file integrity
    if tar -tzf "$backup_file" > /dev/null 2>&1; then
        report "✓ Archive integrity check passed"
    else
        report "✗ Archive integrity check failed"
        return 1
    fi

    # Create temporary directory for extraction
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" RETURN

    # Extract backup
    if tar -xzf "$backup_file" -C "$temp_dir"; then
        report "✓ Backup extraction successful"

        # Count files and directories
        local file_count=$(find "$temp_dir" -type f | wc -l)
        local dir_count=$(find "$temp_dir" -type d | wc -l)
        report "  Files: $file_count, Directories: $dir_count"

        # Check for expected directories
        local expected_dirs=("uploads" "config")
        local missing_dirs=""
        for dir in "${expected_dirs[@]}"; do
            if [ ! -d "$temp_dir/$dir" ]; then
                missing_dirs="$missing_dirs $dir"
            fi
        done

        if [ -n "$missing_dirs" ]; then
            report "⚠ Missing expected directories:$missing_dirs"
        else
            report "✓ All expected directories present"
        fi
    else
        report "✗ Backup extraction failed"
        return 1
    fi

    report "✓ File system backup verification completed successfully"
    return 0
}

# Function to verify a specific backup file
verify_backup_file() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        report "✗ Backup file does not exist: $backup_file"
        return 1
    fi

    local file_size=$(du -sh "$backup_file" | cut -f1)
    local file_date=$(stat -c %y "$backup_file" | cut -d'.' -f1)
    report "Backup file: $(basename "$backup_file")"
    report "Size: $file_size"
    report "Date: $file_date"

    if [[ "$backup_file" == *db_backup_* ]]; then
        verify_db_backup "$backup_file"
    elif [[ "$backup_file" == *file_backup_* ]]; then
        verify_file_backup "$backup_file"
    else
        report "⚠ Unknown backup type: $(basename "$backup_file")"
        return 1
    fi
}

# Function to verify all backups
verify_all_backups() {
    report "=== Backup Verification Report ==="
    report "Generated: $(date)"
    report ""

    local total_backups=0
    local passed_verifications=0
    local failed_verifications=0

    # Find all backup files
    local backup_files=$(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f 2>/dev/null | sort)

    if [ -z "$backup_files" ]; then
        report "No backup files found in $BACKUP_DIR"
        return
    fi

    for backup_file in $backup_files; do
        ((total_backups++))
        report ""

        if verify_backup_file "$backup_file"; then
            ((passed_verifications++))
        else
            ((failed_verifications++))
        fi
    done

    report ""
    report "=== Summary ==="
    report "Total backups: $total_backups"
    report "Passed verifications: $passed_verifications"
    report "Failed verifications: $failed_verifications"

    if [ $failed_verifications -gt 0 ]; then
        alert "Backup verification found $failed_verifications failed backups" "warning"
    else
        alert "All $total_backups backups passed verification" "info"
    fi
}

# Main execution
main() {
    log "=== Backup Verification Started ==="

    # Check if backup directory exists
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Backup directory $BACKUP_DIR does not exist"
        exit 1
    fi

    # Initialize report file
    echo "TRIXTECH Backup Verification Report" > "$REPORT_FILE"
    echo "===================================" >> "$REPORT_FILE"

    if [ $# -eq 0 ]; then
        # Verify all backups
        verify_all_backups
    else
        # Verify specific backup file
        verify_backup_file "$1"
    fi

    log "Verification report saved to: $REPORT_FILE"
    log "=== Backup Verification Completed ==="
}

# Run main function
main "$@"