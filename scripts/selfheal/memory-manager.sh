#!/bin/bash

# TRIXTECH Booking System - Memory Management
# Monitors memory usage per container, restarts services with memory leaks,
# adjusts container memory limits dynamically, and logs usage patterns.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/memory-manager.log"
STATS_LOG="${SCRIPT_DIR}/../logs/memory-stats.log"
MEMORY_THRESHOLD=80  # percentage
MEMORY_LEAK_THRESHOLD=85  # percentage
MEMORY_INCREASE_STEP=50  # MB
MAX_MEMORY_LIMIT=1024  # MB
MONITOR_INTERVAL=60  # seconds
STATS_RETENTION_HOURS=24
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
    # Integrate with monitoring system
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "TRIXTECH Memory Management Alert" "$ALERT_EMAIL"
    fi
}

# Get memory usage for a container
get_container_memory() {
    local container="$1"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" "$container" 2>/dev/null | tail -1 | awk '{print $3}' | sed 's/%//'
}

# Parse memory usage (e.g., "100MiB / 512MiB" -> percentage)
parse_memory_usage() {
    local mem_string="$1"
    # Extract used and total memory
    local used=$(echo "$mem_string" | awk -F'/' '{print $1}' | sed 's/[^0-9.]*//g')
    local total=$(echo "$mem_string" | awk -F'/' '{print $2}' | sed 's/[^0-9.]*//g')
    local unit_used=$(echo "$mem_string" | awk -F'/' '{print $1}' | sed 's/[0-9.]*//g')
    local unit_total=$(echo "$mem_string" | awk -F'/' '{print $2}' | sed 's/[0-9.]*//g')

    # Convert to MB for calculation
    if [[ "$unit_used" == "GiB" ]]; then
        used=$(echo "$used * 1024" | bc)
    fi
    if [[ "$unit_total" == "GiB" ]]; then
        total=$(echo "$total * 1024" | bc)
    fi

    # Calculate percentage
    if (( $(echo "$total > 0" | bc -l) )); then
        echo "scale=2; $used * 100 / $total" | bc
    else
        echo "0"
    fi
}

# Get current memory limit for container
get_memory_limit() {
    local container="$1"
    docker inspect "$container" --format '{{.HostConfig.Memory}}' 2>/dev/null | awk '{print int($1/1024/1024)}' || echo "0"
}

# Adjust memory limit for container
adjust_memory_limit() {
    local container="$1"
    local current_limit=$(get_memory_limit "$container")
    local new_limit=$(( current_limit + MEMORY_INCREASE_STEP ))

    if (( new_limit > MAX_MEMORY_LIMIT )); then
        log "WARN" "Cannot increase memory limit for $container beyond maximum ($MAX_MEMORY_LIMIT MB)"
        return 1
    fi

    log "INFO" "Adjusting memory limit for $container from ${current_limit}MB to ${new_limit}MB"
    if docker update --memory "${new_limit}m" "$container" >/dev/null 2>&1; then
        log "INFO" "Memory limit updated successfully for $container"
        return 0
    else
        log "ERROR" "Failed to update memory limit for $container"
        return 1
    fi
}

# Restart container due to memory issues
restart_container_memory() {
    local container="$1"
    local reason="$2"

    log "WARN" "Restarting $container due to memory issue: $reason"

    if docker restart "$container" >/dev/null 2>&1; then
        log "INFO" "Successfully restarted $container"
        return 0
    else
        alert "Failed to restart $container due to memory issue"
        return 1
    fi
}

# Log memory statistics
log_memory_stats() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    if ! docker info >/dev/null 2>&1; then
        return
    fi

    docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}" | tail -n +2 | while read -r line; do
        local container=$(echo "$line" | awk '{print $1}')
        local mem_usage=$(echo "$line" | awk '{print $2"/"$3}')
        local mem_percent=$(parse_memory_usage "$mem_usage")

        echo "$timestamp,$container,$mem_usage,$mem_percent" >> "$STATS_LOG"
    done
}

# Analyze memory patterns (simple trend detection)
analyze_memory_patterns() {
    local container="$1"
    local hours=1

    # Get average memory usage over last hour
    local avg_usage=$(tail -n $((hours * 60)) "$STATS_LOG" 2>/dev/null | grep "$container" | awk -F',' '{sum += $4} END {if (NR > 0) print sum/NR; else print 0}')

    if (( $(echo "$avg_usage > $MEMORY_LEAK_THRESHOLD" | bc -l) )); then
        log "WARN" "Potential memory leak detected in $container (avg usage: ${avg_usage}%)"
        return 1
    fi

    return 0
}

# Monitor memory usage
monitor_memory() {
    if ! docker info >/dev/null 2>&1; then
        log "WARN" "Docker daemon not running, skipping memory monitoring"
        return
    fi

    local containers=$(docker ps --format "{{.Names}}" | grep -E "(booking|payment|notification|database|redis)" || true)

    for container in $containers; do
        local mem_stats=$(docker stats --no-stream --format "{{.MemPerc}}" "$container" 2>/dev/null | tr -d '%')
        local mem_usage=$(echo "$mem_stats" | awk '{print int($1)}')

        if [[ -z "$mem_usage" ]] || ! [[ "$mem_usage" =~ ^[0-9]+$ ]]; then
            continue
        fi

        log "INFO" "Memory usage for $container: ${mem_usage}%"

        # Check for high memory usage
        if (( mem_usage > MEMORY_THRESHOLD )); then
            log "WARN" "High memory usage detected for $container: ${mem_usage}%"

            # Try to adjust memory limit first
            if ! adjust_memory_limit "$container"; then
                # If adjustment fails or reaches max, restart
                restart_container_memory "$container" "high memory usage (${mem_usage}%)"
            fi
        fi

        # Check for memory leaks
        if ! analyze_memory_patterns "$container"; then
            restart_container_memory "$container" "potential memory leak detected"
        fi
    done
}

# Cleanup old stats
cleanup_stats() {
    # Keep stats for specified hours
    local cutoff=$(date -d "$STATS_RETENTION_HOURS hours ago" +%Y-%m-%d)
    sed -i "/^$cutoff/,$ d" "$STATS_LOG" 2>/dev/null || true
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/memory-manager.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping memory management"
        return 0
    fi
    return 1
}

# Main monitoring loop
main() {
    log "INFO" "Starting TRIXTECH Memory Manager"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    while true; do
        # Log memory stats
        log_memory_stats

        # Monitor and manage memory
        monitor_memory

        # Cleanup old stats
        cleanup_stats

        sleep "$MONITOR_INTERVAL"
    done
}

# Run main function
main "$@"