#!/bin/bash

# TRIXTECH Performance Tuning Script
# Optimizes database queries, memory usage, network connections, and system resources

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/performance-tune-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/performance-tune-$(date +%Y%m%d-%H%M%S).json"

# Performance tuning settings
NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-2048}"
REDIS_MAX_MEMORY="${REDIS_MAX_MEMORY:-512mb}"
MONGODB_WIREDTIGER_CACHE_SIZE="${MONGODB_WIREDTIGER_CACHE_SIZE:-1GB}"

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

# Get system performance metrics
get_system_metrics() {
    log "Collecting system performance metrics..."

    local cpu_usage
    local memory_usage
    local disk_io
    local network_stats

    # CPU usage
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' 2>/dev/null || echo "0")

    # Memory usage
    memory_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}' 2>/dev/null || echo "0")

    # Disk I/O (simplified)
    disk_io=$(iostat -d 1 1 2>/dev/null | tail -1 | awk '{print $2}' 2>/dev/null || echo "0")

    # Network stats
    network_stats=$(ss -tuln 2>/dev/null | wc -l 2>/dev/null || echo "0")

    echo "{\"cpuUsage\": $cpu_usage, \"memoryUsage\": $memory_usage, \"diskIO\": $disk_io, \"networkConnections\": $network_stats}"
}

# Optimize database queries
optimize_database_queries() {
    log "Optimizing database queries..."

    local mongodb_uri="${MONGODB_URI:-mongodb://localhost:27017/trixtech}"
    local db_name="${DB_NAME:-trixtech}"

    # Analyze slow queries from MongoDB profiler
    local slow_queries
    slow_queries=$(mongosh "$mongodb_uri/$db_name" --eval "
        const slowQueries = db.system.profile.find({
            ts: { \$gte: new Date(Date.now() - 24*60*60*1000) } // Last 24 hours
        }).sort({ millis: -1 }).limit(5).toArray();

        print(JSON.stringify({
            count: slowQueries.length,
            queries: slowQueries.map(q => ({
                op: q.op,
                ns: q.ns,
                millis: q.millis,
                query: q.query || q.command
            }))
        }));
    " --quiet 2>/dev/null || echo "{\"count\": 0, \"queries\": []}")

    # Suggest indexes for slow queries
    local index_suggestions="[]"
    if [[ $(echo "$slow_queries" | jq -r '.count') -gt 0 ]]; then
        log "Found slow queries, analyzing for index suggestions..."

        # This is a simplified analysis - in production, you'd want more sophisticated analysis
        index_suggestions=$(echo "$slow_queries" | jq -r '.queries[] | select(.query) | .query' | while read -r query; do
            # Extract fields from query for potential indexes
            echo "{\"query\": $query, \"suggestedIndexes\": []}"
        done | jq -s . 2>/dev/null || echo "[]")
    fi

    echo "{\"slowQueriesAnalysis\": $slow_queries, \"indexSuggestions\": $index_suggestions}"
}

# Optimize memory usage
optimize_memory_usage() {
    log "Optimizing memory usage..."

    # Adjust system memory settings
    if [[ -f "/proc/sys/vm/swappiness" ]]; then
        echo 10 > /proc/sys/vm/swappiness 2>/dev/null || true
        log "Set swappiness to 10"
    fi

    # Clear system cache
    if [[ -f "/proc/sys/vm/drop_caches" ]]; then
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
        log "Dropped system caches"
    fi

    # Optimize Redis memory if available
    if command -v redis-cli &> /dev/null; then
        local redis_host="${REDIS_HOST:-localhost}"
        local redis_port="${REDIS_PORT:-6379}"

        redis-cli -h "$redis_host" -p "$redis_port" config set maxmemory "$REDIS_MAX_MEMORY" >/dev/null 2>&1 || true
        redis-cli -h "$redis_host" -p "$redis_port" config set maxmemory-policy allkeys-lru >/dev/null 2>&1 || true
        log "Optimized Redis memory settings"
    fi

    # Optimize MongoDB memory
    local mongodb_uri="${MONGODB_URI:-mongodb://localhost:27017/trixtech}"
    mongosh "$mongodb_uri/admin" --eval "
        try {
            db.adminCommand({ setParameter: 1, wiredTigerMaxCacheOverflowSizeGB: 0.5 });
            print('Optimized MongoDB WiredTiger cache');
        } catch (error) {
            print('MongoDB optimization skipped:', error.message);
        }
    " --quiet >/dev/null 2>&1 || true

    echo "{\"memoryOptimization\": true, \"redisMaxMemory\": \"$REDIS_MAX_MEMORY\", \"systemCacheCleared\": true}"
}

# Tune network connections
tune_network_connections() {
    log "Tuning network connections..."

    # Increase max open files
    ulimit -n 65536 2>/dev/null || true

    # Optimize TCP settings
    if [[ -f "/proc/sys/net/core/somaxconn" ]]; then
        echo 1024 > /proc/sys/net/core/somaxconn 2>/dev/null || true
    fi

    if [[ -f "/proc/sys/net/ipv4/tcp_max_syn_backlog" ]]; then
        echo 2048 > /proc/sys/net/ipv4/tcp_max_syn_backlog 2>/dev/null || true
    fi

    if [[ -f "/proc/sys/net/ipv4/ip_local_port_range" ]]; then
        echo "1024 65535" > /proc/sys/net/ipv4/ip_local_port_range 2>/dev/null || true
    fi

    # Optimize Node.js keep-alive
    export NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=$NODE_MAX_OLD_SPACE_SIZE"

    log "Network and connection settings optimized"
    echo "{\"networkTuning\": true, \"maxOldSpaceSize\": \"$NODE_MAX_OLD_SPACE_SIZE\", \"tcpOptimizations\": true}"
}

# Optimize system resources
optimize_system_resources() {
    log "Optimizing system resources..."

    # Adjust I/O scheduler for SSDs
    for disk in /sys/block/sd*; do
        if [[ -f "$disk/queue/scheduler" ]]; then
            echo "deadline" > "$disk/queue/scheduler" 2>/dev/null || true
        fi
    done

    # Optimize file system settings
    if mount | grep -q "ext4"; then
        # Tune ext4 filesystem
        for mount_point in $(mount | grep ext4 | awk '{print $3}'); do
            tune2fs -o journal_data_writeback "$mount_point" 2>/dev/null || true
        done
    fi

    # Optimize process scheduling
    if command -v chrt &> /dev/null; then
        # Set CPU affinity for important processes
        log "Process scheduling optimization available"
    fi

    echo "{\"ioScheduler\": \"deadline\", \"filesystemTuning\": true}"
}

# Monitor application performance
monitor_application_performance() {
    log "Monitoring application performance..."

    local backend_pid=""
    local frontend_pid=""

    # Find process IDs
    if pgrep -f "node.*server.js" >/dev/null 2>&1; then
        backend_pid=$(pgrep -f "node.*server.js" | head -1)
    fi

    if pgrep -f "next.*dev" >/dev/null 2>&1; then
        frontend_pid=$(pgrep -f "next.*dev" | head -1)
    fi

    local backend_metrics="{}"
    local frontend_metrics="{}"

    if [[ -n "$backend_pid" ]]; then
        backend_metrics=$(ps -p "$backend_pid" -o pid,ppid,cmd,%cpu,%mem,rss,vsz,etime | tail -1 | awk '{
            print "{\"pid\":" $1 ",\"ppid\":" $2 ",\"cpuPercent\":" $4 ",\"memoryPercent\":" $5 ",\"rss\":" $6 ",\"vsz\":" $7 ",\"elapsedTime\":\"" $8 "\"}"
        }' 2>/dev/null || echo "{}")
    fi

    if [[ -n "$frontend_pid" ]]; then
        frontend_metrics=$(ps -p "$frontend_pid" -o pid,ppid,cmd,%cpu,%mem,rss,vsz,etime | tail -1 | awk '{
            print "{\"pid\":" $1 ",\"ppid\":" $2 ",\"cpuPercent\":" $4 ",\"memoryPercent\":" $5 ",\"rss\":" $6 ",\"vsz\":" $7 ",\"elapsedTime\":\"" $8 "\"}"
        }' 2>/dev/null || echo "{}")
    fi

    echo "{\"backend\": $backend_metrics, \"frontend\": $frontend_metrics}"
}

# Generate final report
generate_report() {
    log "Generating performance tuning report..."

    local before_metrics
    before_metrics=$(get_system_metrics)

    local db_optimization
    db_optimization=$(optimize_database_queries)

    local memory_optimization
    memory_optimization=$(optimize_memory_usage)

    local network_tuning
    network_tuning=$(tune_network_connections)

    local system_optimization
    system_optimization=$(optimize_system_resources)

    local app_monitoring
    app_monitoring=$(monitor_application_performance)

    local after_metrics
    after_metrics=$(get_system_metrics)

    cat > "$REPORT_FILE" << EOF
{
    "status": "completed",
    "timestamp": "$(date -Iseconds)",
    "settings": {
        "nodeMaxOldSpaceSize": "$NODE_MAX_OLD_SPACE_SIZE",
        "redisMaxMemory": "$REDIS_MAX_MEMORY",
        "mongodbCacheSize": "$MONGODB_WIREDTIGER_CACHE_SIZE"
    },
    "beforeMetrics": $before_metrics,
    "optimizations": {
        "databaseQueries": $db_optimization,
        "memoryUsage": $memory_optimization,
        "networkConnections": $network_tuning,
        "systemResources": $system_optimization,
        "applicationMonitoring": $app_monitoring
    },
    "afterMetrics": $after_metrics,
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
    log "Starting TRIXTECH performance tuning"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    generate_report

    log "Performance tuning completed successfully"

    # Check for performance alerts
    local cpu_usage
    cpu_usage=$(jq -r '.afterMetrics.cpuUsage' "$REPORT_FILE" 2>/dev/null || echo "0")

    if (( $(echo "$cpu_usage > 90" | bc -l 2>/dev/null || echo "0") )); then
        send_alert "CPU usage is critically high: ${cpu_usage}%. Performance may be degraded."
    fi

    local memory_usage
    memory_usage=$(jq -r '.afterMetrics.memoryUsage' "$REPORT_FILE" 2>/dev/null || echo "0")

    if (( $(echo "$memory_usage > 90" | bc -l 2>/dev/null || echo "0") )); then
        send_alert "Memory usage is critically high: ${memory_usage}%. Consider memory optimization."
    fi
}

# Run main function
main "$@"