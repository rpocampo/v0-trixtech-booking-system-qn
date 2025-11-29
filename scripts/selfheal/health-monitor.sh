#!/bin/bash

# TRIXTECH Booking System - Service Health Monitor
# Monitors Docker container health and status, checks service availability,
# detects crashed/unresponsive containers, and tracks restart patterns.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/health-monitor.log"
RESTART_LOG="${SCRIPT_DIR}/../logs/restart-counts.log"
HEALTH_CHECK_INTERVAL=30  # seconds
MAX_RESTARTS_PER_HOUR=5
ALERT_EMAIL="admin@trixtech.com"

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
    # Integrate with monitoring system (e.g., send to webhook or email)
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "TRIXTECH Self-Healing Alert" "$ALERT_EMAIL"
    fi
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        alert "Docker daemon is not running"
        return 1
    fi
    return 0
}

# Get container health status
get_container_health() {
    local container="$1"
    docker inspect "$container" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unhealthy"
}

# Check health endpoint
check_health_endpoint() {
    local service="$1"
    local endpoint="$2"
    local timeout=10

    if curl -f -s --max-time "$timeout" "$endpoint" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Get restart count for container
get_restart_count() {
    local container="$1"
    local hour=$(date +%Y%m%d%H)
    grep "$container $hour" "$RESTART_LOG" | awk '{sum += $3} END {print sum+0}'
}

# Record restart
record_restart() {
    local container="$1"
    local hour=$(date +%Y%m%d%H)
    echo "$container $hour 1" >> "$RESTART_LOG"
}

# Restart container if unhealthy
restart_container() {
    local container="$1"
    local restart_count=$(get_restart_count "$container")

    if (( restart_count >= MAX_RESTARTS_PER_HOUR )); then
        alert "Container $container has reached maximum restarts per hour ($MAX_RESTARTS_PER_HOUR)"
        return 1
    fi

    log "INFO" "Restarting unhealthy container: $container"
    if docker restart "$container" >/dev/null 2>&1; then
        record_restart "$container"
        log "INFO" "Successfully restarted container: $container"
        return 0
    else
        alert "Failed to restart container: $container"
        return 1
    fi
}

# Main monitoring loop
monitor_services() {
    local services=("booking-service" "payment-service" "notification-service" "database" "redis")
    local health_endpoints=(
        "http://localhost:3000/health"
        "http://localhost:3001/health"
        "http://localhost:3002/health"
        ""  # database doesn't have HTTP endpoint
        ""  # redis doesn't have HTTP endpoint
    )

    while true; do
        if ! check_docker; then
            sleep "$HEALTH_CHECK_INTERVAL"
            continue
        fi

        for i in "${!services[@]}"; do
            local service="${services[$i]}"
            local endpoint="${health_endpoints[$i]}"

            # Check if container is running
            if ! docker ps --format "table {{.Names}}" | grep -q "^${service}$"; then
                alert "Container $service is not running"
                restart_container "$service"
                continue
            fi

            # Check container health (if healthcheck is configured)
            local health_status=$(get_container_health "$service")
            if [[ "$health_status" == "unhealthy" ]]; then
                log "WARN" "Container $service is unhealthy"
                restart_container "$service"
                continue
            fi

            # Check health endpoint if available
            if [[ -n "$endpoint" ]]; then
                if ! check_health_endpoint "$service" "$endpoint"; then
                    log "WARN" "Health endpoint check failed for $service"
                    restart_container "$service"
                fi
            fi
        done

        sleep "$HEALTH_CHECK_INTERVAL"
    done
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/health-monitor.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping health checks"
        return 0
    fi
    return 1
}

# Cleanup old logs
cleanup_logs() {
    # Keep logs for 30 days
    find "${SCRIPT_DIR}/../logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
    # Rotate restart log weekly
    if [[ $(date +%u) -eq 7 ]]; then
        mv "$RESTART_LOG" "${RESTART_LOG}.$(date +%Y%m%d)" 2>/dev/null || true
    fi
}

# Main function
main() {
    log "INFO" "Starting TRIXTECH Service Health Monitor"

    # Create log directories if they don't exist
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"

    # Cleanup old logs
    cleanup_logs

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    # Trap for clean exit
    trap 'log "INFO" "Health monitor stopped"' EXIT

    # Start monitoring
    monitor_services
}

# Run main function
main "$@"