#!/bin/bash

# TRIXTECH Log Rotation Script
# Rotates application logs, compresses old logs, and cleans up logs older than 90 days

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/log-rotate-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/log-rotate-$(date +%Y%m%d-%H%M%S).json"

# Log directories and files to rotate
LOG_DIRS=(
    "$PROJECT_ROOT/logs"
    "$PROJECT_ROOT/backend/logs"
    "$PROJECT_ROOT/frontend/logs"
    "/var/log/nginx"  # For production with nginx
)

# Retention settings
MAX_AGE_DAYS=90
COMPRESS_AFTER_ROTATIONS=3

# Create directories
mkdir -p "$PROJECT_ROOT/logs/maintenance"
mkdir -p "$PROJECT_ROOT/reports/maintenance"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    echo "{\"status\": \"failed\", \"error\": \"$1\", \"timestamp\": \"$(date -Iseconds)\"}" > "$REPORT_FILE"
    exit 1
}

# Check if directory exists
check_log_dir() {
    local dir="$1"
    if [[ ! -d "$dir" ]]; then
        log "Log directory $dir does not exist, skipping"
        return 1
    fi
    return 0
}

# Rotate a single log file
rotate_log_file() {
    local log_file="$1"
    local base_name="${log_file%.*}"
    local extension="${log_file##*.}"

    if [[ ! -f "$log_file" ]]; then
        return 0
    fi

    log "Rotating log file: $log_file"

    # Find the highest rotation number
    local max_rot=0
    for rotated_file in "${base_name}".*."${extension}"; do
        if [[ -f "$rotated_file" ]]; then
            local rot_num
            rot_num=$(echo "$rotated_file" | sed -E "s|${base_name}\.([0-9]+)\.${extension}|\1|")
            if [[ "$rot_num" =~ ^[0-9]+$ ]] && (( rot_num > max_rot )); then
                max_rot=$rot_num
            fi
        fi
    done

    # Rotate existing files
    for ((i=max_rot; i>=1; i--)); do
        local old_file="${base_name}.${i}.${extension}"
        local new_file="${base_name}.$((i+1)).${extension}"
        if [[ -f "$old_file" ]]; then
            mv "$old_file" "$new_file"
            log "Moved $old_file to $new_file"
        fi
    done

    # Move current log to .1
    mv "$log_file" "${base_name}.1.${extension}"
    log "Rotated $log_file to ${base_name}.1.${extension}"

    # Compress old rotations
    for ((i=COMPRESS_AFTER_ROTATIONS; i<=max_rot+1; i++)); do
        local file_to_compress="${base_name}.${i}.${extension}"
        if [[ -f "$file_to_compress" && ! -f "${file_to_compress}.gz" ]]; then
            gzip "$file_to_compress"
            log "Compressed $file_to_compress"
        fi
    done
}

# Clean up old logs
cleanup_old_logs() {
    local dir="$1"
    log "Cleaning up logs older than $MAX_AGE_DAYS days in $dir"

    local deleted_count=0
    local deleted_size=0

    # Find and remove old compressed logs
    while IFS= read -r -d '' old_file; do
        local file_size
        file_size=$(stat -f%z "$old_file" 2>/dev/null || stat -c%s "$old_file" 2>/dev/null || echo 0)
        rm -f "$old_file"
        ((deleted_count++))
        ((deleted_size += file_size))
        log "Deleted old log: $old_file (${file_size} bytes)"
    done < <(find "$dir" -name "*.log.gz" -mtime +$MAX_AGE_DAYS -print0 2>/dev/null || true)

    # Find and remove old uncompressed logs (safety check)
    while IFS= read -r -d '' old_file; do
        local file_size
        file_size=$(stat -f%z "$old_file" 2>/dev/null || stat -c%s "$old_file" 2>/dev/null || echo 0)
        rm -f "$old_file"
        ((deleted_count++))
        ((deleted_size += file_size))
        log "Deleted old uncompressed log: $old_file (${file_size} bytes)"
    done < <(find "$dir" -name "*.log.*" -mtime +$MAX_AGE_DAYS -print0 2>/dev/null || true)

    echo "{\"directory\": \"$dir\", \"deletedFiles\": $deleted_count, \"deletedSize\": $deleted_size}"
}

# Monitor log sizes
monitor_log_sizes() {
    local dir="$1"
    log "Monitoring log sizes in $dir"

    local total_size=0
    local file_count=0
    local large_files=()

    while IFS= read -r -d '' log_file; do
        if [[ -f "$log_file" ]]; then
            local file_size
            file_size=$(stat -f%z "$log_file" 2>/dev/null || stat -c%s "$log_file" 2>/dev/null || echo 0)
            ((total_size += file_size))
            ((file_count++))

            # Check for large files (>100MB)
            if (( file_size > 104857600 )); then
                large_files+=("{\"file\": \"$log_file\", \"size\": $file_size}")
            fi
        fi
    done < <(find "$dir" -name "*.log*" -print0 2>/dev/null || true)

    local large_files_json="[]"
    if (( ${#large_files[@]} > 0 )); then
        large_files_json="[$(IFS=,; echo "${large_files[*]}")]"
    fi

    echo "{\"directory\": \"$dir\", \"totalSize\": $total_size, \"fileCount\": $file_count, \"largeFiles\": $large_files_json}"
}

# Process all log directories
process_log_directories() {
    local all_cleanup_results="[]"
    local all_monitor_results="[]"
    local rotated_files=()

    for log_dir in "${LOG_DIRS[@]}"; do
        if check_log_dir "$log_dir"; then
            log "Processing log directory: $log_dir"

            # Find all log files in directory
            while IFS= read -r -d '' log_file; do
                if [[ -f "$log_file" && "$log_file" != *.gz ]]; then
                    rotate_log_file "$log_file"
                    rotated_files+=("\"$log_file\"")
                fi
            done < <(find "$log_dir" -name "*.log" -print0 2>/dev/null || true)

            # Cleanup old logs
            local cleanup_result
            cleanup_result=$(cleanup_old_logs "$log_dir")
            all_cleanup_results=$(echo "$all_cleanup_results" | jq ". + [$cleanup_result]" 2>/dev/null || echo "$all_cleanup_results")

            # Monitor sizes
            local monitor_result
            monitor_result=$(monitor_log_sizes "$log_dir")
            all_monitor_results=$(echo "$all_monitor_results" | jq ". + [$monitor_result]" 2>/dev/null || echo "$all_monitor_results")
        fi
    done

    local rotated_files_json="[]"
    if (( ${#rotated_files[@]} > 0 )); then
        rotated_files_json="[$(IFS=,; echo "${rotated_files[*]}")]"
    fi

    echo "{\"rotatedFiles\": $rotated_files_json, \"cleanupResults\": $all_cleanup_results, \"monitorResults\": $all_monitor_results}"
}

# Generate final report
generate_report() {
    log "Generating log rotation report..."

    local process_results
    process_results=$(process_log_directories)

    cat > "$REPORT_FILE" << EOF
{
    "status": "completed",
    "timestamp": "$(date -Iseconds)",
    "maxAgeDays": $MAX_AGE_DAYS,
    "compressAfterRotations": $COMPRESS_AFTER_ROTATIONS,
    "logDirectories": $(printf '%s\n' "${LOG_DIRS[@]}" | jq -R . | jq -s .),
    "results": $process_results,
    "logFile": "$LOG_FILE"
}
EOF

    log "Report generated: $REPORT_FILE"
}

# Send alert if needed
send_alert() {
    local alert_message="$1"
    log "ALERT: $alert_message"

    # In production, integrate with monitoring system
    # Example: curl -X POST -H "Content-Type: application/json" -d "{\"message\": \"$alert_message\"}" $MONITORING_WEBHOOK
}

# Main execution
main() {
    log "Starting TRIXTECH log rotation"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    generate_report

    log "Log rotation completed successfully"

    # Check for alerts
    if jq -e '.results.monitorResults[] | select(.largeFiles | length > 0)' "$REPORT_FILE" > /dev/null 2>&1; then
        send_alert "Large log files detected. Check maintenance report for details."
    fi
}

# Run main function
main "$@"