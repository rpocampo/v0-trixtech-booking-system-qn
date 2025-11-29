#!/bin/bash

# TRIXTECH Backup Monitoring Script
# Monitors backup operations and sends alerts
# Tracks backup success/failure and storage usage
# Integrates with monitoring and alerting systems

set -e  # Exit on any error

# Configuration from environment variables
BACKUP_DIR="${BACKUP_DIR:-/backups}"
LOG_FILE="${LOG_FILE:-/var/log/trixtech/backup-monitor.log}"
MONITORING_URL="${MONITORING_URL:-http://localhost:5000/api/health}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}"
SENDGRID_API_KEY="${SENDGRID_API_KEY}"
ALERT_EMAIL_RECIPIENTS="${ALERT_EMAIL_RECIPIENTS}"
SENDGRID_FROM_EMAIL="${SENDGRID_FROM_EMAIL:-alerts@trixtech.com}"

# Monitoring thresholds
MAX_BACKUP_AGE_HOURS="${MAX_BACKUP_AGE_HOURS:-25}"  # Alert if no backup in 25 hours
MIN_BACKUP_COUNT="${MIN_BACKUP_COUNT:-3}"          # Minimum number of backups to keep
MAX_STORAGE_PERCENT="${MAX_STORAGE_PERCENT:-85}"    # Alert if storage usage > 85%

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [BACKUP-MONITOR] $1" | tee -a "$LOG_FILE"
}

# Alert function for Slack
send_slack_alert() {
    local message="$1"
    local severity="${2:-warning}"

    if [ -z "$SLACK_WEBHOOK_URL" ]; then
        log "Slack webhook URL not configured, skipping Slack alert"
        return
    fi

    local color="warning"
    case "$severity" in
        "critical") color="danger" ;;
        "warning") color="warning" ;;
        "info") color="good" ;;
    esac

    local payload=$(cat <<EOF
{
    "text": "🚨 *BACKUP MONITOR ALERT*",
    "attachments": [{
        "color": "$color",
        "fields": [
            {"title": "Alert", "value": "$message", "short": true},
            {"title": "Severity", "value": "$severity", "short": true},
            {"title": "Time", "value": "$(date -Iseconds)", "short": true}
        ],
        "footer": "TRIXTECH Backup Monitor"
    }]
}
EOF
)

    if curl -s -X POST "$SLACK_WEBHOOK_URL" \
         -H "Content-Type: application/json" \
         -d "$payload" > /dev/null 2>&1; then
        log "Slack alert sent successfully"
    else
        log "Failed to send Slack alert"
    fi
}

# Alert function for email
send_email_alert() {
    local subject="$1"
    local message="$2"
    local severity="${3:-warning}"

    if [ -z "$SENDGRID_API_KEY" ] || [ -z "$ALERT_EMAIL_RECIPIENTS" ]; then
        log "SendGrid not configured, skipping email alert"
        return
    fi

    local html_message=$(cat <<EOF
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <div style="background-color: #dc3545; color: white; padding: 20px; text-align: center;">
        <h1 style="margin: 0;">BACKUP ALERT</h1>
        <h2 style="margin: 10px 0;">$severity</h2>
    </div>
    <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
        <p><strong>Subject:</strong> $subject</p>
        <p><strong>Message:</strong> $message</p>
        <p><strong>Time:</strong> $(date)</p>
    </div>
    <div style="background-color: #f8f9fa; padding: 10px; text-align: center; font-size: 12px; color: #6c757d;">
        TRIXTECH Backup Monitoring System
    </div>
</div>
EOF
)

    local payload=$(cat <<EOF
{
    "personalizations": [{
        "to": $(echo "$ALERT_EMAIL_RECIPIENTS" | jq -R 'split(",") | map({"email": .})')
    }],
    "from": {"email": "$SENDGRID_FROM_EMAIL"},
    "subject": "[$severity] $subject",
    "content": [{"type": "text/html", "value": "$html_message"}]
}
EOF
)

    if curl -s -X POST "https://api.sendgrid.com/v3/mail/send" \
         -H "Authorization: Bearer $SENDGRID_API_KEY" \
         -H "Content-Type: application/json" \
         -d "$payload" > /dev/null 2>&1; then
        log "Email alert sent successfully"
    else
        log "Failed to send email alert"
    fi
}

# Send alert through all configured channels
send_alert() {
    local message="$1"
    local severity="${2:-warning}"

    log "ALERT [$severity]: $message"

    send_slack_alert "$message" "$severity"
    send_email_alert "Backup Monitor Alert" "$message" "$severity"
}

# Check backup directory existence
check_backup_directory() {
    if [ ! -d "$BACKUP_DIR" ]; then
        send_alert "Backup directory does not exist: $BACKUP_DIR" "critical"
        return 1
    fi

    log "Backup directory exists: $BACKUP_DIR"
    return 0
}

# Check for recent backups
check_recent_backups() {
    local recent_backups=$(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f -mtime -"$MAX_BACKUP_AGE_HOURS" 2>/dev/null | wc -l)
    local latest_backup=$(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1)

    if [ "$recent_backups" -eq 0 ]; then
        send_alert "No recent backups found (checked last $MAX_BACKUP_AGE_HOURS hours)" "critical"
        return 1
    fi

    if [ -n "$latest_backup" ]; then
        local latest_time=$(echo "$latest_backup" | cut -d' ' -f1)
        local latest_file=$(echo "$latest_backup" | cut -d' ' -f2-)
        local age_hours=$(( ($(date +%s) - ${latest_time%.*}) / 3600 ))

        log "Latest backup: $(basename "$latest_file") (${age_hours} hours old)"

        if [ "$age_hours" -gt "$MAX_BACKUP_AGE_HOURS" ]; then
            send_alert "Latest backup is too old: ${age_hours} hours (threshold: $MAX_BACKUP_AGE_HOURS hours)" "warning"
        fi
    fi

    return 0
}

# Check backup storage usage
check_storage_usage() {
    # Get disk usage for backup directory
    local usage_info=$(df -h "$BACKUP_DIR" | tail -1)
    local usage_percent=$(echo "$usage_info" | awk '{print $5}' | sed 's/%//')

    if [ "$usage_percent" -gt "$MAX_STORAGE_PERCENT" ]; then
        send_alert "Backup storage usage is high: ${usage_percent}% (threshold: $MAX_STORAGE_PERCENT%)" "warning"
    fi

    log "Backup storage usage: ${usage_percent}%"

    # Check backup directory size
    local backup_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log "Total backup size: $backup_size"
}

# Check backup count and cleanup old ones
check_backup_count() {
    local backup_files=$(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f 2>/dev/null | wc -l)

    log "Total backup files: $backup_files"

    if [ "$backup_files" -lt "$MIN_BACKUP_COUNT" ]; then
        send_alert "Low backup count: $backup_files (minimum required: $MIN_BACKUP_COUNT)" "warning"
    fi

    # List backups by age
    log "Backup files by age:"
    find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
        sort -n | while read -r line; do
        local mtime=$(echo "$line" | cut -d' ' -f1)
        local file=$(echo "$line" | cut -d' ' -f2-)
        local age_days=$(( ($(date +%s) - ${mtime%.*}) / 86400 ))
        log "  $(basename "$file") - ${age_days} days old"
    done
}

# Check backup verification status
check_verification_status() {
    # Look for verification reports
    local report_dir="${REPORT_DIR:-/reports}"
    local latest_report=$(find "$report_dir" -name "verification_report_*.txt" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1)

    if [ -z "$latest_report" ]; then
        log "No verification reports found"
        return
    fi

    local report_file=$(echo "$latest_report" | cut -d' ' -f2-)
    local report_age_hours=$(( ($(date +%s) - $(echo "$latest_report" | cut -d' ' -f1 | cut -d'.' -f1)) / 3600 ))

    log "Latest verification report: $(basename "$report_file") (${report_age_hours} hours old)"

    # Check if verification passed
    if grep -q "Failed verifications: [1-9]" "$report_file" 2>/dev/null; then
        send_alert "Backup verification failures detected. Check report: $(basename "$report_file")" "critical"
    elif [ "$report_age_hours" -gt 24 ]; then
        send_alert "Backup verification report is old: ${report_age_hours} hours (should run daily)" "warning"
    fi
}

# Check backup job status (if monitoring URL is available)
check_backup_job_status() {
    if [ -z "$MONITORING_URL" ]; then
        log "Monitoring URL not configured, skipping job status check"
        return
    fi

    # Try to get health status
    local health_response=$(curl -s "$MONITORING_URL" 2>/dev/null)
    if [ $? -eq 0 ] && echo "$health_response" | grep -q "backup"; then
        log "Health check includes backup status"
        # Parse backup status from health response if available
    else
        log "Could not retrieve backup status from monitoring endpoint"
    fi
}

# Generate monitoring report
generate_report() {
    local report_file="/tmp/backup_monitor_report_$(date +%Y%m%d_%H%M%S).txt"

    {
        echo "TRIXTECH Backup Monitor Report"
        echo "Generated: $(date)"
        echo "================================"
        echo ""
        echo "Configuration:"
        echo "  Backup Directory: $BACKUP_DIR"
        echo "  Max Backup Age: $MAX_BACKUP_AGE_HOURS hours"
        echo "  Min Backup Count: $MIN_BACKUP_COUNT"
        echo "  Max Storage Usage: $MAX_STORAGE_PERCENT%"
        echo ""
        echo "Current Status:"
        echo "  Directory exists: $([ -d "$BACKUP_DIR" ] && echo "Yes" || echo "No")"
        echo "  Recent backups: $(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f -mtime -"$MAX_BACKUP_AGE_HOURS" 2>/dev/null | wc -l)"
        echo "  Total backups: $(find "$BACKUP_DIR" -name "*_backup_*.tar.gz" -type f 2>/dev/null | wc -l)"
        echo "  Storage usage: $(df -h "$BACKUP_DIR" 2>/dev/null | tail -1 | awk '{print $5}')"
        echo "  Total size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
    } > "$report_file"

    log "Report generated: $report_file"
}

# Main execution
main() {
    log "=== Backup Monitor Started ==="

    local has_errors=0

    # Run all checks
    check_backup_directory || has_errors=1
    check_recent_backups || has_errors=1
    check_storage_usage
    check_backup_count
    check_verification_status
    check_backup_job_status

    # Generate report
    generate_report

    if [ $has_errors -eq 0 ]; then
        log "All backup checks passed"
    else
        log "Some backup checks failed"
    fi

    log "=== Backup Monitor Completed ==="
    return $has_errors
}

# Run main function
main "$@"