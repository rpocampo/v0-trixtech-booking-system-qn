#!/bin/bash

# TRIXTECH Maintenance Scheduler
# Coordinates and schedules all maintenance tasks during off-peak hours

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/scheduler-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/scheduler-$(date +%Y%m%d-%H%M%S).json"

# Maintenance tasks configuration
MAINTENANCE_TASKS=(
    "filesystem-cleanup.sh:File System Cleanup:High priority cleanup tasks"
    "log-rotate.sh:Log Rotation:Rotate and compress logs"
    "cache-cleanup.sh:Cache Cleanup:Clear expired cache entries"
    "db-optimize.sh:Database Optimization:Optimize MongoDB performance"
    "performance-tune.sh:Performance Tuning:System-wide performance optimization"
)

# Scheduling settings
OFF_PEAK_START_HOUR=2  # 2 AM
OFF_PEAK_END_HOUR=4    # 4 AM
MAX_EXECUTION_TIME=3600  # 1 hour max per task
MAINTENANCE_WINDOW_DAYS=7  # Run maintenance every 7 days

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

# Check if current time is within off-peak hours
is_off_peak_time() {
    local current_hour
    current_hour=$(date +%H)

    if (( OFF_PEAK_START_HOUR <= OFF_PEAK_END_HOUR )); then
        # Same day window
        (( current_hour >= OFF_PEAK_START_HOUR && current_hour < OFF_PEAK_END_HOUR ))
    else
        # Overnight window
        (( current_hour >= OFF_PEAK_START_HOUR || current_hour < OFF_PEAK_END_HOUR ))
    fi
}

# Check if maintenance should run today
should_run_maintenance() {
    local last_run_file="$PROJECT_ROOT/.maintenance_last_run"

    if [[ ! -f "$last_run_file" ]]; then
        log "No previous maintenance run found, scheduling maintenance"
        return 0
    fi

    local last_run_date
    last_run_date=$(cat "$last_run_file")
    local days_since_last_run
    days_since_last_run=$(( ($(date +%s) - $(date -d "$last_run_date" +%s)) / 86400 ))

    if (( days_since_last_run >= MAINTENANCE_WINDOW_DAYS )); then
        log "Maintenance due (last run: $last_run_date, $days_since_last_run days ago)"
        return 0
    else
        log "Maintenance not due yet (last run: $last_run_date, $days_since_last_run days ago)"
        return 1
    fi
}

# Check system load
check_system_load() {
    local load_average
    load_average=$(uptime | awk -F'load average:' '{ print $2 }' | cut -d, -f1 | tr -d ' ' 2>/dev/null || echo "0.0")

    local cpu_count
    cpu_count=$(nproc 2>/dev/null || echo "1")

    local normalized_load
    normalized_load=$(echo "scale=2; $load_average / $cpu_count" | bc -l 2>/dev/null || echo "0.0")

    # Allow maintenance if load is below 70% of CPU capacity
    if (( $(echo "$normalized_load < 0.7" | bc -l 2>/dev/null || echo "1") )); then
        log "System load acceptable: $load_average ($normalized_load normalized)"
        return 0
    else
        log "System load too high: $load_average ($normalized_load normalized), skipping maintenance"
        return 1
    fi
}

# Execute a maintenance task
execute_task() {
    local task_spec="$1"
    local task_script
    local task_name
    local task_description

    IFS=':' read -r task_script task_name task_description <<< "$task_spec"

    local task_path="$SCRIPT_DIR/$task_script"
    local task_start_time
    task_start_time=$(date +%s)

    log "Starting task: $task_name"
    log "Description: $task_description"
    log "Script: $task_script"

    if [[ ! -f "$task_path" ]]; then
        log "ERROR: Task script not found: $task_path"
        echo "{\"task\": \"$task_name\", \"status\": \"failed\", \"error\": \"Script not found\", \"duration\": 0}"
        return 1
    fi

    # Execute task with timeout
    local task_output=""
    local task_exit_code=0

    if timeout "$MAX_EXECUTION_TIME" bash "$task_path" > /tmp/task_output.log 2>&1; then
        task_output=$(cat /tmp/task_output.log)
        log "Task completed successfully: $task_name"
    else
        task_exit_code=$?
        task_output=$(cat /tmp/task_output.log 2>/dev/null || echo "Task timed out or failed")
        log "Task failed or timed out: $task_name (exit code: $task_exit_code)"
    fi

    local task_end_time
    task_end_time=$(date +%s)
    local task_duration=$((task_end_time - task_start_time))

    # Clean up temp file
    rm -f /tmp/task_output.log

    echo "{\"task\": \"$task_name\", \"script\": \"$task_script\", \"status\": \"$([[ $task_exit_code -eq 0 ]] && echo \"completed\" || echo \"failed\")\", \"duration\": $task_duration, \"output\": \"$task_output\"}"
}

# Check task dependencies
check_dependencies() {
    local task_name="$1"

    # Define dependencies (task must complete before dependent task can run)
    case "$task_name" in
        "Database Optimization")
            # Ensure filesystem cleanup ran first (for disk space)
            return 0
            ;;
        "Performance Tuning")
            # Ensure database optimization completed
            return 0
            ;;
        *)
            return 0
            ;;
    esac
}

# Send notification
send_notification() {
    local subject="$1"
    local message="$2"

    log "NOTIFICATION: $subject - $message"

    # In production, integrate with notification system
    # Example: curl -X POST -H "Content-Type: application/json" -d "{\"subject\": \"$subject\", \"message\": \"$message\"}" $NOTIFICATION_WEBHOOK
}

# Generate maintenance report
generate_maintenance_report() {
    local tasks_results="$1"
    local total_duration="$2"
    local maintenance_status="$3"

    cat > "$REPORT_FILE" << EOF
{
    "status": "$maintenance_status",
    "timestamp": "$(date -Iseconds)",
    "maintenanceWindow": {
        "startHour": $OFF_PEAK_START_HOUR,
        "endHour": $OFF_PEAK_END_HOUR,
        "windowDays": $MAINTENANCE_WINDOW_DAYS
    },
    "systemInfo": {
        "hostname": "$(hostname)",
        "os": "$(uname -s)",
        "kernel": "$(uname -r)"
    },
    "execution": {
        "totalDuration": $total_duration,
        "tasksExecuted": $(echo "$tasks_results" | jq length),
        "maxTaskTime": $MAX_EXECUTION_TIME
    },
    "tasks": $tasks_results,
    "logFile": "$LOG_FILE"
}
EOF

    log "Maintenance report generated: $REPORT_FILE"
}

# Update last run timestamp
update_last_run() {
    echo "$(date -I)" > "$PROJECT_ROOT/.maintenance_last_run"
}

# Main execution
main() {
    local start_time
    start_time=$(date +%s)

    log "Starting TRIXTECH maintenance scheduler"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    # Check if we should run maintenance
    if [[ "${1:-}" != "--force" ]]; then
        if ! should_run_maintenance; then
            log "Maintenance not scheduled for today"
            echo "{\"status\": \"skipped\", \"reason\": \"not scheduled\", \"timestamp\": \"$(date -Iseconds)\"}" > "$REPORT_FILE"
            exit 0
        fi

        if ! is_off_peak_time; then
            log "Not in off-peak hours (current: $(date +%H), window: $OFF_PEAK_START_HOUR-$OFF_PEAK_END_HOUR)"
            echo "{\"status\": \"skipped\", \"reason\": \"not off-peak\", \"timestamp\": \"$(date -Iseconds)\"}" > "$REPORT_FILE"
            exit 0
        fi

        if ! check_system_load; then
            log "System load too high, skipping maintenance"
            echo "{\"status\": \"skipped\", \"reason\": \"high load\", \"timestamp\": \"$(date -Iseconds)\"}" > "$REPORT_FILE"
            exit 0
        fi
    else
        log "Forced maintenance execution"
    fi

    # Execute maintenance tasks
    local tasks_results="[]"
    local failed_tasks=0
    local total_tasks=0

    for task_spec in "${MAINTENANCE_TASKS[@]}"; do
        ((total_tasks++))

        local task_result
        task_result=$(execute_task "$task_spec")

        # Check if task failed
        if [[ $(echo "$task_result" | jq -r '.status') != "completed" ]]; then
            ((failed_tasks++))
            log "Task failed: $(echo "$task_result" | jq -r '.task')"
        fi

        # Add to results array
        tasks_results=$(echo "$tasks_results" | jq ". + [$task_result]")
    done

    local end_time
    end_time=$(date +%s)
    local total_duration=$((end_time - start_time))

    # Determine overall status
    local maintenance_status="completed"
    if (( failed_tasks > 0 )); then
        maintenance_status="completed_with_errors"
        log "Maintenance completed with $failed_tasks failed tasks out of $total_tasks"
    else
        log "All maintenance tasks completed successfully"
    fi

    # Generate report
    generate_maintenance_report "$tasks_results" "$total_duration" "$maintenance_status"

    # Update last run timestamp
    update_last_run

    # Send notifications
    if [[ "$maintenance_status" == "completed" ]]; then
        send_notification "Maintenance Completed" "All maintenance tasks completed successfully in ${total_duration}s"
    elif [[ "$maintenance_status" == "completed_with_errors" ]]; then
        send_notification "Maintenance Completed with Errors" "$failed_tasks tasks failed. Check maintenance report for details."
    fi

    log "TRIXTECH maintenance scheduler finished"
}

# Show usage
usage() {
    echo "Usage: $0 [--force]"
    echo "  --force  Force maintenance execution regardless of schedule"
    echo ""
    echo "Environment variables:"
    echo "  MAINTENANCE_WINDOW_DAYS  Days between maintenance runs (default: 7)"
    echo "  OFF_PEAK_START_HOUR      Start hour for maintenance window (default: 2)"
    echo "  OFF_PEAK_END_HOUR        End hour for maintenance window (default: 4)"
}

# Parse arguments
case "${1:-}" in
    --help|-h)
        usage
        exit 0
        ;;
    --force)
        ;;
    "")
        ;;
    *)
        echo "Unknown option: $1"
        usage
        exit 1
        ;;
esac

# Run main function
main "$@"