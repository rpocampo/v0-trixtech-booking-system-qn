#!/bin/bash

# TRIXTECH Database Optimization Script
# Performs MongoDB index optimization, collection compaction, and performance analysis

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/db-optimize-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/db-optimize-$(date +%Y%m%d-%H%M%S).json"

# Environment variables (should be set in production)
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/trixtech}"
DB_NAME="${DB_NAME:-trixtech}"

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

# Check if MongoDB is accessible
check_mongodb_connection() {
    log "Checking MongoDB connection..."
    if ! mongosh --eval "db.adminCommand('ping')" "$MONGODB_URI" --quiet; then
        error_exit "Cannot connect to MongoDB at $MONGODB_URI"
    fi
    log "MongoDB connection successful"
}

# Get database statistics
get_db_stats() {
    log "Collecting database statistics..."
    mongosh "$MONGODB_URI/$DB_NAME" --eval "
        const stats = db.stats();
        print(JSON.stringify({
            db: '$DB_NAME',
            collections: stats.collections,
            objects: stats.objects,
            avgObjSize: stats.avgObjSize,
            dataSize: stats.dataSize,
            storageSize: stats.storageSize,
            indexes: stats.indexes,
            indexSize: stats.indexSize,
            totalSize: stats.totalSize,
            timestamp: new Date().toISOString()
        }, null, 2));
    " --quiet > "$REPORT_FILE.tmp" || error_exit "Failed to collect database statistics"
}

# Optimize indexes
optimize_indexes() {
    log "Optimizing database indexes..."
    local collections
    collections=$(mongosh "$MONGODB_URI/$DB_NAME" --eval "db.getCollectionNames().join(' ')" --quiet)

    for collection in $collections; do
        log "Rebuilding indexes for collection: $collection"
        if ! mongosh "$MONGODB_URI/$DB_NAME" --eval "
            try {
                const result = db.runCommand({ reIndex: '$collection' });
                print(JSON.stringify({
                    collection: '$collection',
                    reIndexResult: result,
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                print(JSON.stringify({
                    collection: '$collection',
                    error: error.message,
                    timestamp: new Date().toISOString()
                }));
            }
        " --quiet; then
            log "Warning: Failed to reindex collection $collection"
        fi
    done
}

# Compact collections
compact_collections() {
    log "Compacting database collections..."
    local collections
    collections=$(mongosh "$MONGODB_URI/$DB_NAME" --eval "db.getCollectionNames().join(' ')" --quiet)

    for collection in $collections; do
        log "Compacting collection: $collection"
        if ! mongosh "$MONGODB_URI/$DB_NAME" --eval "
            try {
                const result = db.runCommand({ compact: '$collection' });
                print(JSON.stringify({
                    collection: '$collection',
                    compactResult: result,
                    timestamp: new Date().toISOString()
                }));
            } catch (error) {
                print(JSON.stringify({
                    collection: '$collection',
                    error: error.message,
                    timestamp: new Date().toISOString()
                }));
            }
        " --quiet; then
            log "Warning: Failed to compact collection $collection"
        fi
    done
}

# Analyze query performance
analyze_query_performance() {
    log "Analyzing query performance..."

    # Enable profiling temporarily
    mongosh "$MONGODB_URI/$DB_NAME" --eval "
        db.setProfilingLevel(2, { slowms: 100 });
        print('Profiling enabled for slow queries (>100ms)');
    " --quiet

    # Wait a bit for some queries to be profiled (in production, this might be longer)
    sleep 30

    # Get slow queries
    mongosh "$MONGODB_URI/$DB_NAME" --eval "
        const slowQueries = db.system.profile.find({
            ts: { \$gte: new Date(Date.now() - 3600000) } // Last hour
        }).sort({ ts: -1 }).limit(10).toArray();

        print(JSON.stringify({
            slowQueries: slowQueries.map(q => ({
                op: q.op,
                ns: q.ns,
                millis: q.millis,
                ts: q.ts,
                query: q.query || q.command
            })),
            timestamp: new Date().toISOString()
        }, null, 2));
    " --quiet > "$REPORT_FILE.queries"

    # Disable profiling
    mongosh "$MONGODB_URI/$DB_NAME" --eval "db.setProfilingLevel(0);" --quiet
}

# Generate final report
generate_report() {
    log "Generating optimization report..."

    local final_stats
    final_stats=$(mongosh "$MONGODB_URI/$DB_NAME" --eval "
        const stats = db.stats();
        print(JSON.stringify({
            afterOptimization: {
                collections: stats.collections,
                objects: stats.objects,
                dataSize: stats.dataSize,
                storageSize: stats.storageSize,
                indexes: stats.indexes,
                indexSize: stats.indexSize,
                totalSize: stats.totalSize
            }
        }));
    " --quiet)

    local slow_queries=""
    if [[ -f "$REPORT_FILE.queries" ]]; then
        slow_queries=$(cat "$REPORT_FILE.queries")
    fi

    cat > "$REPORT_FILE" << EOF
{
    "status": "completed",
    "timestamp": "$(date -Iseconds)",
    "database": "$DB_NAME",
    "mongodbUri": "$MONGODB_URI",
    "actions": [
        "index_optimization",
        "collection_compaction",
        "query_performance_analysis"
    ],
    "beforeStats": $(cat "$REPORT_FILE.tmp" 2>/dev/null || echo "{}"),
    "afterStats": $final_stats,
    "slowQueries": $slow_queries,
    "logFile": "$LOG_FILE"
}
EOF

    log "Report generated: $REPORT_FILE"
}

# Main execution
main() {
    log "Starting TRIXTECH database optimization"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    check_mongodb_connection
    get_db_stats
    optimize_indexes
    compact_collections
    analyze_query_performance
    generate_report

    log "Database optimization completed successfully"
}

# Run main function
main "$@"