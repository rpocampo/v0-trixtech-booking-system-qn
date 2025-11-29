#!/bin/bash

# TRIXTECH Scheduled Backup Orchestrator
# Sets up cron jobs for daily backups at 2 AM
# Includes error handling and retry logic
# Integrates with monitoring system

set -e  # Exit on any error

# Configuration from environment variables
BACKUP_SCRIPTS_DIR="${BACKUP_SCRIPTS_DIR:-/app/scripts/backup}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:3001/api/monitoring/alert}"
MAX_RETRIES="${MAX_RETRIES:-3}"
RETRY_DELAY="${RETRY_DELAY:-300}"  # 5 minutes

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [SCHEDULER] $1" | tee -a "$LOG_FILE"
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
            -d "{\"message\":\"Scheduled Backup: $message\",\"level\":\"$level\"}" || true
    fi
}

# Function to run backup with retry logic
run_backup_with_retry() {
    local script_name="$1"
    local script_path="$BACKUP_SCRIPTS_DIR/$script_name"

    if [ ! -f "$script_path" ]; then
        alert "Backup script not found: $script_path"
        return 1
    fi

    local attempt=1
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Running $script_name (attempt $attempt/$MAX_RETRIES)"

        if bash "$script_path"; then
            log "$script_name completed successfully on attempt $attempt"
            return 0
        else
            log "$script_name failed on attempt $attempt"

            if [ $attempt -lt $MAX_RETRIES ]; then
                log "Retrying $script_name in $RETRY_DELAY seconds..."
                sleep $RETRY_DELAY
            fi
        fi

        ((attempt++))
    done

    alert "$script_name failed after $MAX_RETRIES attempts"
    return 1
}

# Function to perform daily backup routine
perform_daily_backup() {
    log "=== Starting Daily Backup Routine ==="

    local failed_backups=0

    # Run database backup
    if ! run_backup_with_retry "db-backup.sh"; then
        ((failed_backups++))
    fi

    # Run file system backup
    if ! run_backup_with_retry "file-backup.sh"; then
        ((failed_backups++))
    fi

    # Run cleanup
    if ! run_backup_with_retry "cleanup-backups.sh"; then
        log "Warning: Cleanup failed, but continuing..."
    fi

    # Run verification
    if ! run_backup_with_retry "verify-backup.sh"; then
        log "Warning: Verification failed, but backups may still be valid"
    fi

    if [ $failed_backups -gt 0 ]; then
        alert "Daily backup completed with $failed_backups failures" "warning"
    else
        alert "Daily backup completed successfully" "info"
    fi

    log "=== Daily Backup Routine Completed ==="
}

# Function to setup cron job
setup_cron() {
    log "Setting up cron job for daily backups at 2 AM"

    # Create a wrapper script for cron
    local cron_script="/app/scripts/backup/daily-backup-cron.sh"
    cat > "$cron_script" << 'EOF'
#!/bin/bash
# Daily backup cron script
export PATH="/usr/local/bin:/usr/bin:/bin"
cd /app
exec /app/scripts/backup/schedule-backups.sh --run-daily
EOF

    chmod +x "$cron_script"

    # Add to crontab (0 2 * * * means daily at 2 AM)
    local cron_entry="0 2 * * * $cron_script"

    # Check if cron entry already exists
    if crontab -l 2>/dev/null | grep -q "$cron_script"; then
        log "Cron job already exists"
    else
        # Add the cron job
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        log "Cron job added: $cron_entry"
    fi

    alert "Cron job setup completed" "info"
}

# Function to remove cron job
remove_cron() {
    log "Removing cron job"

    local cron_script="/app/scripts/backup/daily-backup-cron.sh"

    # Remove from crontab
    crontab -l 2>/dev/null | grep -v "$cron_script" | crontab -

    # Remove the wrapper script
    if [ -f "$cron_script" ]; then
        rm "$cron_script"
        log "Removed cron wrapper script"
    fi

    alert "Cron job removed" "info"
}

# Function to show cron status
show_cron_status() {
    log "=== Cron Job Status ==="

    if crontab -l 2>/dev/null | grep -q "daily-backup-cron.sh"; then
        log "✓ Cron job is active"
        crontab -l | grep "daily-backup-cron.sh"
    else
        log "✗ No cron job found"
    fi
}

# Main execution
main() {
    case "${1:-}" in
        --setup-cron)
            setup_cron
            ;;
        --remove-cron)
            remove_cron
            ;;
        --run-daily)
            perform_daily_backup
            ;;
        --status)
            show_cron_status
            ;;
        --test)
            log "Running test backup (without cron)"
            perform_daily_backup
            ;;
        *)
            echo "Usage: $0 {--setup-cron|--remove-cron|--run-daily|--status|--test}"
            echo "  --setup-cron    Setup daily cron job at 2 AM"
            echo "  --remove-cron   Remove the cron job"
            echo "  --run-daily     Run the daily backup routine (called by cron)"
            echo "  --status        Show cron job status"
            echo "  --test          Run backup routine for testing"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"