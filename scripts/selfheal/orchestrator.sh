#!/bin/bash

# TRIXTECH Booking System - Self-Healing Orchestrator
# Coordinates all self-healing activities with prioritization and rate limiting
# to prevent cascading failures and ensure system stability.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/orchestrator.log"
STATUS_FILE="${SCRIPT_DIR}/../status/selfheal.status"
ORCHESTRATOR_INTERVAL=300  # 5 minutes
RATE_LIMIT_WINDOW=3600  # 1 hour
MAX_RECOVERIES_PER_WINDOW=10
ALERT_EMAIL="admin@trixtech.com"

# Recovery priorities (lower number = higher priority)
declare -A RECOVERY_PRIORITIES=(
    ["db-recovery"]=1
    ["health-monitor"]=2
    ["memory-manager"]=3
    ["network-recovery"]=4
    ["config-recovery"]=5
    ["disk-cleanup"]=6
)

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
        echo "$message" | mail -s "TRIXTECH Self-Healing Orchestrator Alert" "$ALERT_EMAIL"
    fi
}

# Update status file
update_status() {
    local component="$1"
    local status="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    mkdir -p "${SCRIPT_DIR}/../status"
    echo "$timestamp,$component,$status" >> "$STATUS_FILE"
}

# Get component status
get_component_status() {
    local component="$1"
    tail -n 20 "$STATUS_FILE" 2>/dev/null | grep "$component" | tail -1 | cut -d',' -f3 || echo "unknown"
}

# Check rate limiting
check_rate_limit() {
    local window_start=$(date -d "$RATE_LIMIT_WINDOW seconds ago" +%s)
    local recovery_count=$(awk -F',' -v start="$window_start" '
        BEGIN { count = 0 }
        {
            # Convert timestamp to epoch
            cmd = "date -d \"" $1 "\" +%s"
            cmd | getline epoch
            close(cmd)
            if (epoch >= start && $3 == "completed") count++
        }
        END { print count }
    ' "$STATUS_FILE" 2>/dev/null || echo "0")

    if (( recovery_count >= MAX_RECOVERIES_PER_WINDOW )); then
        log "WARN" "Rate limit exceeded: $recovery_count recoveries in last $RATE_LIMIT_WINDOW seconds"
        return 1
    fi

    return 0
}

# Execute recovery script
execute_recovery() {
    local script_name="$1"
    local script_path="${SCRIPT_DIR}/${script_name}.sh"

    if [[ ! -x "$script_path" ]]; then
        log "ERROR" "Recovery script not found or not executable: $script_path"
        return 1
    fi

    log "INFO" "Executing recovery script: $script_name"
    update_status "$script_name" "running"

    local start_time=$(date +%s)

    if timeout 600 bash "$script_path" >> "$LOG_FILE" 2>&1; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "INFO" "Recovery script $script_name completed successfully in ${duration}s"
        update_status "$script_name" "completed"
        return 0
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log "ERROR" "Recovery script $script_name failed (exit code: $exit_code) after ${duration}s"
        update_status "$script_name" "failed"
        return 1
    fi
}

# Get prioritized recovery list
get_prioritized_recoveries() {
    local recoveries=("db-recovery" "health-monitor" "memory-manager" "network-recovery" "config-recovery" "disk-cleanup")

    # Sort by priority
    printf '%s\n' "${recoveries[@]}" | while read -r recovery; do
        local priority=${RECOVERY_PRIORITIES[$recovery]:-999}
        echo "$priority $recovery"
    done | sort -n | cut -d' ' -f2-
}

# Check if component needs recovery
needs_recovery() {
    local component="$1"

    case "$component" in
        db-recovery)
            # Check database connectivity
            if ! PGPASSWORD="${DB_PASSWORD:-password}" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-trixtech}" -c "SELECT 1;" --quiet --tuples-only --no-align >/dev/null 2>&1; then
                return 0
            fi
            ;;
        health-monitor)
            # Check if any containers are unhealthy
            if docker ps --format "{{.Names}}" | xargs -I {} docker inspect {} --format '{{.State.Health.Status}}' 2>/dev/null | grep -q "unhealthy"; then
                return 0
            fi
            ;;
        memory-manager)
            # Check memory usage
            if docker stats --no-stream --format "{{.MemPerc}}" 2>/dev/null | tr -d '%' | awk '$1 > 80 {exit 0} {exit 1}'; then
                return 0
            fi
            ;;
        network-recovery)
            # Check external connectivity
            if ! curl -f -s --max-time 10 https://www.google.com >/dev/null 2>&1; then
                return 0
            fi
            ;;
        config-recovery)
            # Check config files exist and are valid
            local config_files=("${SCRIPT_DIR}/../../backend/.env" "${SCRIPT_DIR}/../../frontend/.env")
            for config in "${config_files[@]}"; do
                if [[ ! -f "$config" ]]; then
                    return 0
                fi
            done
            ;;
        disk-cleanup)
            # Check disk usage
            if (( $(df / | tail -1 | awk '{print int($5)}') > 85 )); then
                return 0
            fi
            ;;
    esac

    return 1
}

# Prevent cascading failures
prevent_cascading() {
    local recent_failures=$(tail -n 50 "$STATUS_FILE" 2>/dev/null | grep "failed" | wc -l)

    if (( recent_failures > 5 )); then
        log "WARN" "Multiple recent failures detected, pausing orchestrator to prevent cascading failures"
        alert "Self-healing orchestrator paused due to multiple failures - manual intervention may be required"
        sleep 1800  # Pause for 30 minutes
        return 1
    fi

    return 0
}

# Send health report
send_health_report() {
    local report_file="${SCRIPT_DIR}/../reports/health-report.txt"
    mkdir -p "${SCRIPT_DIR}/../reports"

    {
        echo "TRIXTECH Self-Healing Health Report"
        echo "Generated: $(date)"
        echo "=================================="
        echo ""
        echo "Component Status:"
        tail -n 20 "$STATUS_FILE" 2>/dev/null | while IFS=',' read -r timestamp component status; do
            echo "  $component: $status ($timestamp)"
        done
        echo ""
        echo "Recent Alerts:"
        tail -n 10 "$LOG_FILE" 2>/dev/null | grep "ALERT" || echo "  No recent alerts"
        echo ""
        echo "System Resources:"
        echo "  Disk Usage: $(df -h / | tail -1 | awk '{print $5}')"
        echo "  Memory Usage: $(free -h | grep '^Mem:' | awk '{print $3 "/" $2}')"
        echo "  Load Average: $(uptime | awk -F'load average:' '{print $2}')"
    } > "$report_file"

    log "INFO" "Health report generated: $report_file"
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/orchestrator.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, pausing orchestrator"
        return 0
    fi
    return 1
}

# Cleanup old status entries
cleanup_status() {
    # Keep only last 1000 entries
    if [[ -f "$STATUS_FILE" ]]; then
        tail -n 1000 "$STATUS_FILE" > "${STATUS_FILE}.tmp" && mv "${STATUS_FILE}.tmp" "$STATUS_FILE"
    fi
}

# Main orchestration loop
main() {
    log "INFO" "Starting TRIXTECH Self-Healing Orchestrator"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"
    mkdir -p "${SCRIPT_DIR}/../status"
    mkdir -p "${SCRIPT_DIR}/../reports"

    # Cleanup old status
    cleanup_status

    while true; do
        # Check for manual override
        if check_manual_override; then
            sleep "$ORCHESTRATOR_INTERVAL"
            continue
        fi

        # Prevent cascading failures
        if ! prevent_cascading; then
            continue
        fi

        # Check rate limiting
        if ! check_rate_limit; then
            sleep "$ORCHESTRATOR_INTERVAL"
            continue
        fi

        # Get prioritized recovery list
        local recoveries=$(get_prioritized_recoveries)
        local executed_count=0

        # Execute recoveries that are needed
        for recovery in $recoveries; do
            if needs_recovery "$recovery"; then
                log "INFO" "Recovery needed for: $recovery"

                if execute_recovery "$recovery"; then
                    ((executed_count++))
                    # Small delay between recoveries to prevent overwhelming the system
                    sleep 30
                fi
            else
                log "DEBUG" "Recovery not needed for: $recovery"
            fi
        done

        if (( executed_count > 0 )); then
            log "INFO" "Orchestrator cycle completed: $executed_count recoveries executed"
        fi

        # Send periodic health report (every 6 cycles = 30 minutes)
        if (( $(date +%M) % 30 == 0 )); then
            send_health_report
        fi

        sleep "$ORCHESTRATOR_INTERVAL"
    done
}

# Run main function
main "$@"