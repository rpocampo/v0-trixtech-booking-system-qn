#!/bin/bash

# TRIXTECH Cache Cleanup Script
# Clears Redis cache selectively, optimizes memory usage, and monitors cache performance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/cache-cleanup-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/cache-cleanup-$(date +%Y%m%d-%H%M%S).json"

# Redis configuration
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DB="${REDIS_DB:-0}"

# Cache cleanup settings
SESSION_TTL_HOURS=24
TEMP_DATA_TTL_HOURS=1
OLD_DATA_DAYS=7

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

# Redis CLI command builder
redis_cmd() {
    local cmd="$1"
    local redis_cli="redis-cli -h $REDIS_HOST -p $REDIS_PORT"

    if [[ -n "$REDIS_PASSWORD" ]]; then
        redis_cli="$redis_cli -a $REDIS_PASSWORD"
    fi

    if [[ -n "$REDIS_DB" && "$REDIS_DB" != "0" ]]; then
        redis_cli="$redis_cli -n $REDIS_DB"
    fi

    echo "$redis_cli $cmd"
}

# Check Redis connection
check_redis_connection() {
    log "Checking Redis connection..."
    if ! $(redis_cmd "ping") | grep -q "PONG"; then
        error_exit "Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT"
    fi
    log "Redis connection successful"
}

# Get Redis statistics
get_redis_stats() {
    log "Collecting Redis statistics..."

    local info
    info=$($(redis_cmd "info") 2>/dev/null || echo "")

    if [[ -z "$info" ]]; then
        error_exit "Failed to get Redis info"
    fi

    # Parse key stats
    local used_memory
    local total_connections_received
    local keyspace_hits
    local keyspace_misses
    local evicted_keys

    used_memory=$(echo "$info" | grep "used_memory:" | cut -d: -f2 | tr -d '\r' || echo "0")
    total_connections_received=$(echo "$info" | grep "total_connections_received:" | cut -d: -f2 | tr -d '\r' || echo "0")
    keyspace_hits=$(echo "$info" | grep "keyspace_hits:" | cut -d: -f2 | tr -d '\r' || echo "0")
    keyspace_misses=$(echo "$info" | grep "keyspace_misses:" | cut -d: -f2 | tr -d '\r' || echo "0")
    evicted_keys=$(echo "$info" | grep "evicted_keys:" | cut -d: -f2 | tr -d '\r' || echo "0")

    local hit_rate="0"
    if (( keyspace_hits + keyspace_misses > 0 )); then
        hit_rate=$(( 100 * keyspace_hits / (keyspace_hits + keyspace_misses) ))
    fi

    echo "{\"usedMemory\": $used_memory, \"totalConnections\": $total_connections_received, \"hitRate\": $hit_rate, \"evictedKeys\": $evicted_keys}"
}

# Clear expired sessions
clear_expired_sessions() {
    log "Clearing expired sessions..."

    local session_pattern="session:*"
    local cleared_count=0

    # Find and delete expired session keys
    local session_keys
    session_keys=$($(redis_cmd "keys \"$session_pattern\"") 2>/dev/null | tr '\n' ' ' || echo "")

    for key in $session_keys; do
        # Check TTL
        local ttl
        ttl=$($(redis_cmd "ttl \"$key\"") 2>/dev/null || echo "-1")

        if [[ "$ttl" == "-1" ]] || (( ttl > SESSION_TTL_HOURS * 3600 )); then
            $(redis_cmd "del \"$key\"") >/dev/null 2>&1
            ((cleared_count++))
            log "Cleared expired session: $key"
        fi
    done

    log "Cleared $cleared_count expired sessions"
    echo "{\"clearedSessions\": $cleared_count}"
}

# Clear old temporary data
clear_old_temp_data() {
    log "Clearing old temporary data..."

    local temp_patterns=("temp:*" "cache:temp:*" "tmp:*")
    local cleared_count=0

    for pattern in "${temp_patterns[@]}"; do
        local keys
        keys=$($(redis_cmd "keys \"$pattern\"") 2>/dev/null | tr '\n' ' ' || echo "")

        for key in $keys; do
            local ttl
            ttl=$($(redis_cmd "ttl \"$key\"") 2>/dev/null || echo "-1")

            if [[ "$ttl" == "-1" ]] || (( ttl > TEMP_DATA_TTL_HOURS * 3600 )); then
                $(redis_cmd "del \"$key\"") >/dev/null 2>&1
                ((cleared_count++))
                log "Cleared old temp data: $key"
            fi
        done
    done

    log "Cleared $cleared_count old temporary data entries"
    echo "{\"clearedTempData\": $cleared_count}"
}

# Clear old cached data
clear_old_cached_data() {
    log "Clearing old cached data..."

    local cache_patterns=("cache:*" "api:cache:*")
    local cleared_count=0
    local cutoff_timestamp
    cutoff_timestamp=$(date -d "$OLD_DATA_DAYS days ago" +%s 2>/dev/null || echo "$(($(date +%s) - OLD_DATA_DAYS * 86400))")

    for pattern in "${cache_patterns[@]}"; do
        local keys
        keys=$($(redis_cmd "keys \"$pattern\"") 2>/dev/null | tr '\n' ' ' || echo "")

        for key in $keys; do
            # For cache entries, we might need to check internal timestamps
            # For simplicity, clear all cache entries older than threshold
            local ttl
            ttl=$($(redis_cmd "ttl \"$key\"") 2>/dev/null || echo "-1")

            if [[ "$ttl" == "-1" ]]; then
                $(redis_cmd "del \"$key\"") >/dev/null 2>&1
                ((cleared_count++))
                log "Cleared old cached data: $key"
            fi
        done
    done

    log "Cleared $cleared_count old cached data entries"
    echo "{\"clearedOldCache\": $cleared_count}"
}

# Optimize Redis memory
optimize_redis_memory() {
    log "Optimizing Redis memory usage..."

    # Trigger background save if not recently done
    local lastsave
    lastsave=$($(redis_cmd "lastsave") 2>/dev/null || echo "0")

    if (( $(date +%s) - lastsave > 3600 )); then  # If last save > 1 hour ago
        log "Triggering background save for memory optimization"
        $(redis_cmd "bgsave") >/dev/null 2>&1
    fi

    # Clear stats if needed
    $(redis_cmd "config resetstat") >/dev/null 2>&1
    log "Reset Redis statistics"

    echo "{\"memoryOptimized\": true, \"backgroundSaveTriggered\": true}"
}

# Clear application-level caches
clear_application_caches() {
    log "Clearing application-level caches..."

    local cleared_dirs=()
    local cleared_files=()

    # Clear Node.js cache if exists
    if [[ -d "$PROJECT_ROOT/backend/.cache" ]]; then
        rm -rf "$PROJECT_ROOT/backend/.cache"/*
        cleared_dirs+=("$PROJECT_ROOT/backend/.cache")
        log "Cleared backend cache directory"
    fi

    if [[ -d "$PROJECT_ROOT/frontend/.next/cache" ]]; then
        rm -rf "$PROJECT_ROOT/frontend/.next/cache"/*
        cleared_dirs+=("$PROJECT_ROOT/frontend/.next/cache")
        log "Cleared frontend Next.js cache"
    fi

    # Clear temp files
    local temp_files
    temp_files=$(find "$PROJECT_ROOT" -name "*.tmp" -o -name "*.temp" -o -name "*~" 2>/dev/null || echo "")

    for temp_file in $temp_files; do
        if [[ -f "$temp_file" ]]; then
            rm -f "$temp_file"
            cleared_files+=("$temp_file")
            log "Removed temp file: $temp_file"
        fi
    done

    echo "{\"clearedDirectories\": $(printf '%s\n' "${cleared_dirs[@]}" | jq -R . | jq -s .), \"clearedFiles\": $(printf '%s\n' "${cleared_files[@]}" | jq -R . | jq -s .)}"
}

# Generate final report
generate_report() {
    log "Generating cache cleanup report..."

    local before_stats
    before_stats=$(get_redis_stats)

    local session_cleanup
    session_cleanup=$(clear_expired_sessions)

    local temp_cleanup
    temp_cleanup=$(clear_old_temp_data)

    local cache_cleanup
    cache_cleanup=$(clear_old_cached_data)

    local memory_optimization
    memory_optimization=$(optimize_redis_memory)

    local app_cache_cleanup
    app_cache_cleanup=$(clear_application_caches)

    local after_stats
    after_stats=$(get_redis_stats)

    cat > "$REPORT_FILE" << EOF
{
    "status": "completed",
    "timestamp": "$(date -Iseconds)",
    "redisHost": "$REDIS_HOST",
    "redisPort": $REDIS_PORT,
    "settings": {
        "sessionTtlHours": $SESSION_TTL_HOURS,
        "tempDataTtlHours": $TEMP_DATA_TTL_HOURS,
        "oldDataDays": $OLD_DATA_DAYS
    },
    "beforeStats": $before_stats,
    "cleanupResults": {
        "sessions": $session_cleanup,
        "tempData": $temp_cleanup,
        "oldCache": $cache_cleanup,
        "memoryOptimization": $memory_optimization,
        "applicationCaches": $app_cache_cleanup
    },
    "afterStats": $after_stats,
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
    log "Starting TRIXTECH cache cleanup"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    check_redis_connection
    generate_report

    log "Cache cleanup completed successfully"

    # Check for alerts (low hit rate, high memory usage)
    local hit_rate
    hit_rate=$(jq -r '.afterStats.hitRate' "$REPORT_FILE" 2>/dev/null || echo "0")

    if (( hit_rate < 50 )); then
        send_alert "Cache hit rate is low: ${hit_rate}%. Consider reviewing cache strategy."
    fi

    local used_memory_mb
    used_memory_mb=$(jq -r '.afterStats.usedMemory' "$REPORT_FILE" 2>/dev/null || echo "0")
    used_memory_mb=$(( used_memory_mb / 1024 / 1024 ))

    if (( used_memory_mb > 500 )); then  # Alert if > 500MB
        send_alert "Redis memory usage is high: ${used_memory_mb}MB. Consider memory optimization."
    fi
}

# Run main function
main "$@"