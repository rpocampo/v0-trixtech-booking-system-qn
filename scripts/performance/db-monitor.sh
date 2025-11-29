#!/bin/bash

# TRIXTECH Database Performance Monitor
# Monitors query execution times, database connection pools, slow queries, and bottlenecks

set -e

# Configuration
ENV=${ENV:-dev}
MONGO_URI=${MONGO_URI:-mongodb://localhost:27017/trixtech}
PROMETHEUS_METRICS_FILE=${PROMETHEUS_METRICS_FILE:-/tmp/db_metrics.prom}
REPORT_DIR=${REPORT_DIR:-reports}
THRESHOLD_SLOW_QUERY=${THRESHOLD_SLOW_QUERY:-100}  # ms
THRESHOLD_CONNECTIONS=${THRESHOLD_CONNECTIONS:-100}

# Create report directory
mkdir -p "$REPORT_DIR"

REPORT_FILE="$REPORT_DIR/db_performance_$(date +%Y%m%d_%H%M%S).txt"

# Function to execute MongoDB command and get JSON output
mongo_cmd() {
  local cmd=$1
  mongosh "$MONGO_URI" --quiet --eval "$cmd" --json 2>/dev/null || mongo "$MONGO_URI" --quiet --eval "$cmd" --json 2>/dev/null
}

# Collect database statistics
echo "Collecting database performance metrics..."

# Get server status
server_status=$(mongo_cmd "db.serverStatus()")

# Extract key metrics
connections_current=$(echo "$server_status" | jq -r '.connections.current' 2>/dev/null || echo "0")
connections_available=$(echo "$server_status" | jq -r '.connections.available' 2>/dev/null || echo "0")
opcounters_insert=$(echo "$server_status" | jq -r '.opcounters.insert' 2>/dev/null || echo "0")
opcounters_query=$(echo "$server_status" | jq -r '.opcounters.query' 2>/dev/null || echo "0")
opcounters_update=$(echo "$server_status" | jq -r '.opcounters.update' 2>/dev/null || echo "0")
opcounters_delete=$(echo "$server_status" | jq -r '.opcounters.delete' 2>/dev/null || echo "0")

# Get database stats
db_stats=$(mongo_cmd "db.stats()")
db_size=$(echo "$db_stats" | jq -r '.dataSize' 2>/dev/null || echo "0")
db_storage_size=$(echo "$db_stats" | jq -r '.storageSize' 2>/dev/null || echo "0")
collections_count=$(echo "$db_stats" | jq -r '.collections' 2>/dev/null || echo "0")

# Get slow queries (if profiling is enabled)
slow_queries=$(mongo_cmd "db.system.profile.find({millis: {\$gt: $THRESHOLD_SLOW_QUERY}}).limit(10).toArray()")
slow_query_count=$(echo "$slow_queries" | jq -r 'length' 2>/dev/null || echo "0")

# Get index usage statistics
index_stats=$(mongo_cmd "db.getCollectionNames().map(function(name) { return db.getCollection(name).aggregate([{\$indexStats: {}}]).toArray(); })")
# Note: This is simplified; in practice, you'd need to process each collection

# Calculate derived metrics
total_operations=$((opcounters_insert + opcounters_query + opcounters_update + opcounters_delete))
connection_utilization=$(echo "scale=2; ($connections_current / ($connections_current + $connections_available)) * 100" | bc 2>/dev/null || echo "0")

# Generate Prometheus metrics
prometheus_metrics="# HELP db_connections_current Current number of connections
# TYPE db_connections_current gauge
db_connections_current{env=\"$ENV\"} $connections_current
"

prometheus_metrics="${prometheus_metrics}# HELP db_connections_available Available connections
# TYPE db_connections_available gauge
db_connections_available{env=\"$ENV\"} $connections_available
"

prometheus_metrics="${prometheus_metrics}# HELP db_operations_total Total database operations
# TYPE db_operations_total counter
db_operations_total{operation=\"insert\",env=\"$ENV\"} $opcounters_insert
db_operations_total{operation=\"query\",env=\"$ENV\"} $opcounters_query
db_operations_total{operation=\"update\",env=\"$ENV\"} $opcounters_update
db_operations_total{operation=\"delete\",env=\"$ENV\"} $opcounters_delete
"

prometheus_metrics="${prometheus_metrics}# HELP db_size_bytes Database size in bytes
# TYPE db_size_bytes gauge
db_size_bytes{env=\"$ENV\"} $db_size
"

prometheus_metrics="${prometheus_metrics}# HELP db_storage_size_bytes Database storage size in bytes
# TYPE db_storage_size_bytes gauge
db_storage_size_bytes{env=\"$ENV\"} $db_storage_size
"

prometheus_metrics="${prometheus_metrics}# HELP db_collections_count Number of collections
# TYPE db_collections_count gauge
db_collections_count{env=\"$ENV\"} $collections_count
"

prometheus_metrics="${prometheus_metrics}# HELP db_slow_queries_count Number of slow queries
# TYPE db_slow_queries_count gauge
db_slow_queries_count{env=\"$ENV\"} $slow_query_count
"

prometheus_metrics="${prometheus_metrics}# HELP db_connection_utilization Connection utilization percentage
# TYPE db_connection_utilization gauge
db_connection_utilization{env=\"$ENV\"} $connection_utilization
"

# Write Prometheus metrics
echo -e "$prometheus_metrics" > "$PROMETHEUS_METRICS_FILE"

# Generate detailed report
{
  echo "======================================"
  echo "TRIXTECH Database Performance Report"
  echo "======================================"
  echo "Generated: $(date)"
  echo "Environment: $ENV"
  echo "MongoDB URI: $MONGO_URI"
  echo ""
  echo "CONNECTION POOL METRICS:"
  echo "-----------------------"
  echo "Current Connections: $connections_current"
  echo "Available Connections: $connections_available"
  echo "Connection Utilization: ${connection_utilization}%"
  echo ""
  echo "OPERATION COUNTERS:"
  echo "-------------------"
  echo "Insert Operations: $opcounters_insert"
  echo "Query Operations: $opcounters_query"
  echo "Update Operations: $opcounters_update"
  echo "Delete Operations: $opcounters_delete"
  echo "Total Operations: $total_operations"
  echo ""
  echo "DATABASE SIZE METRICS:"
  echo "----------------------"
  echo "Data Size: $(echo "scale=2; $db_size / 1024 / 1024" | bc 2>/dev/null || echo "0") MB"
  echo "Storage Size: $(echo "scale=2; $db_storage_size / 1024 / 1024" | bc 2>/dev/null || echo "0") MB"
  echo "Collections Count: $collections_count"
  echo ""
  echo "PERFORMANCE ANALYSIS:"
  echo "---------------------"
  if (( connections_current > THRESHOLD_CONNECTIONS )); then
    echo "⚠️  WARNING: High connection count ($connections_current) exceeds threshold ($THRESHOLD_CONNECTIONS)"
  else
    echo "✅ Connection count is within acceptable limits"
  fi

  if (( slow_query_count > 0 )); then
    echo "⚠️  WARNING: $slow_query_count slow queries detected (>$THRESHOLD_SLOW_QUERY ms)"
    echo ""
    echo "SLOW QUERIES DETAILS:"
    echo "$slow_queries" | jq -r '.[] | "  - \(.ns): \(.millis)ms - \(.op)"' 2>/dev/null || echo "  Unable to parse slow queries"
  else
    echo "✅ No slow queries detected"
  fi

  echo ""
  echo "RECOMMENDATIONS:"
  echo "----------------"
  if (( connections_current > THRESHOLD_CONNECTIONS * 0.8 )); then
    echo "- Consider increasing connection pool size or optimizing connection usage"
  fi
  if (( slow_query_count > 5 )); then
    echo "- Review and optimize slow queries"
    echo "- Consider adding indexes for frequently queried fields"
  fi
  if (( $(echo "$db_size > 1000000000" | bc -l 2>/dev/null || echo "0") )); then  # > 1GB
    echo "- Database size is large; consider archiving old data"
  fi
  echo "- Enable profiling for detailed query analysis: db.setProfilingLevel(2, {slowms: 100})"
  echo "- Monitor index usage and remove unused indexes"

} > "$REPORT_FILE"

echo "Database performance monitoring completed."
echo "Report saved to: $REPORT_FILE"
echo "Prometheus metrics exported to: $PROMETHEUS_METRICS_FILE"

# Exit with error code if thresholds exceeded
if (( connections_current > THRESHOLD_CONNECTIONS )) || (( slow_query_count > 10 )); then
  echo "Database performance thresholds exceeded. Check report for details."
  exit 1
fi