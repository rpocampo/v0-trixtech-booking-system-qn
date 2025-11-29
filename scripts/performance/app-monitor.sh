#!/bin/bash

# TRIXTECH Application Performance Monitor
# Monitors response times, throughput, API endpoint performance, and user experience metrics

set -e

# Configuration
ENV=${ENV:-dev}
BASE_URL=${BASE_URL:-http://localhost:5000}
PROMETHEUS_METRICS_FILE=${PROMETHEUS_METRICS_FILE:-/tmp/app_metrics.prom}
REPORT_DIR=${REPORT_DIR:-reports}
THRESHOLD_RESPONSE_TIME=${THRESHOLD_RESPONSE_TIME:-1000}  # ms
THRESHOLD_ERROR_RATE=${THRESHOLD_ERROR_RATE:-0.05}  # 5%

# Create report directory
mkdir -p "$REPORT_DIR"

REPORT_FILE="$REPORT_DIR/app_performance_$(date +%Y%m%d_%H%M%S).txt"

# Endpoints to monitor
ENDPOINTS=(
  "/health"
  "/api/auth/status"
  "/api/bookings"
  "/api/services"
  "/api/users/profile"
  "/api/payments/status"
)

# Metrics variables
declare -A response_times
declare -A status_codes
declare -A request_counts
total_requests=0
total_response_time=0
error_count=0

# Function to measure response time and collect metrics
measure_endpoint() {
  local endpoint=$1
  local url="${BASE_URL}${endpoint}"

  # Use curl to measure response time
  local start_time=$(date +%s%N)
  local http_code=$(curl -s -w "%{http_code}" -o /dev/null --max-time 10 "$url" 2>/dev/null || echo "000")
  local end_time=$(date +%s%N)

  # Calculate response time in milliseconds
  local response_time=$(( (end_time - start_time) / 1000000 ))

  # Store metrics
  response_times["$endpoint"]=$response_time
  status_codes["$endpoint"]=$http_code
  request_counts["$endpoint"]=$(( request_counts["$endpoint"] + 1 ))

  # Update totals
  ((total_requests++))
  total_response_time=$((total_response_time + response_time))

  # Check for errors (non-2xx status codes)
  if [[ $http_code -lt 200 || $http_code -ge 300 ]]; then
    ((error_count++))
  fi

  echo "$endpoint,$http_code,$response_time"
}

# Collect metrics for all endpoints
echo "Collecting application performance metrics..."

metrics_output=""
for endpoint in "${ENDPOINTS[@]}"; do
  result=$(measure_endpoint "$endpoint")
  metrics_output="${metrics_output}$result\n"
done

# Calculate averages and rates
avg_response_time=$(( total_requests > 0 ? total_response_time / total_requests : 0 ))
error_rate=$(echo "scale=4; $error_count / $total_requests" | bc 2>/dev/null || echo "0")

# Generate Prometheus metrics
prometheus_metrics="# HELP app_response_time Response time in milliseconds
# TYPE app_response_time gauge
"

for endpoint in "${!response_times[@]}"; do
  prometheus_metrics="${prometheus_metrics}app_response_time{endpoint=\"$endpoint\",env=\"$ENV\"} ${response_times[$endpoint]}\n"
done

prometheus_metrics="${prometheus_metrics}# HELP app_requests_total Total number of requests
# TYPE app_requests_total counter
"

for endpoint in "${!request_counts[@]}"; do
  prometheus_metrics="${prometheus_metrics}app_requests_total{endpoint=\"$endpoint\",env=\"$ENV\"} ${request_counts[$endpoint]}\n"
done

prometheus_metrics="${prometheus_metrics}# HELP app_avg_response_time Average response time in milliseconds
# TYPE app_avg_response_time gauge
app_avg_response_time{env=\"$ENV\"} $avg_response_time
"

prometheus_metrics="${prometheus_metrics}# HELP app_error_rate Error rate as a percentage
# TYPE app_error_rate gauge
app_error_rate{env=\"$ENV\"} $(echo "$error_rate * 100" | bc -l 2>/dev/null || echo "0")
"

# Write Prometheus metrics
echo -e "$prometheus_metrics" > "$PROMETHEUS_METRICS_FILE"

# Generate detailed report
{
  echo "========================================"
  echo "TRIXTECH Application Performance Report"
  echo "========================================"
  echo "Generated: $(date)"
  echo "Environment: $ENV"
  echo "Base URL: $BASE_URL"
  echo ""
  echo "SUMMARY METRICS:"
  echo "----------------"
  echo "Total Requests: $total_requests"
  echo "Average Response Time: ${avg_response_time}ms"
  echo "Error Count: $error_count"
  echo "Error Rate: $(echo "scale=2; $error_rate * 100" | bc 2>/dev/null || echo "0")%"
  echo ""
  echo "ENDPOINT DETAILS:"
  echo "------------------"
  printf "%-30s %-10s %-15s %-10s\n" "Endpoint" "Status" "Response Time" "Errors"
  printf "%-30s %-10s %-15s %-10s\n" "--------" "------" "--------------" "------"

  for endpoint in "${ENDPOINTS[@]}"; do
    status=${status_codes[$endpoint]}
    time=${response_times[$endpoint]}
    errors=$([ "$status" -lt 200 ] || [ "$status" -ge 300 ] && echo "YES" || echo "NO")
    printf "%-30s %-10s %-15s %-10s\n" "$endpoint" "$status" "${time}ms" "$errors"
  done

  echo ""
  echo "PERFORMANCE ANALYSIS:"
  echo "---------------------"
  if (( avg_response_time > THRESHOLD_RESPONSE_TIME )); then
    echo "⚠️  WARNING: Average response time (${avg_response_time}ms) exceeds threshold (${THRESHOLD_RESPONSE_TIME}ms)"
  else
    echo "✅ Average response time is within acceptable limits"
  fi

  error_rate_percent=$(echo "scale=2; $error_rate * 100" | bc 2>/dev/null || echo "0")
  threshold_percent=$(echo "scale=2; $THRESHOLD_ERROR_RATE * 100" | bc 2>/dev/null || echo "5.00")
  if (( $(echo "$error_rate > $THRESHOLD_ERROR_RATE" | bc -l 2>/dev/null || echo "0") )); then
    echo "⚠️  WARNING: Error rate (${error_rate_percent}%) exceeds threshold (${threshold_percent}%)"
  else
    echo "✅ Error rate is within acceptable limits"
  fi

  echo ""
  echo "USER EXPERIENCE METRICS:"
  echo "------------------------"
  echo "Response Time Distribution:"
  fast_count=0
  medium_count=0
  slow_count=0

  for endpoint in "${ENDPOINTS[@]}"; do
    time=${response_times[$endpoint]}
    if (( time < 200 )); then ((fast_count++))
    elif (( time < 1000 )); then ((medium_count++))
    else ((slow_count++))
    fi
  done

  echo "Fast (<200ms): $fast_count endpoints"
  echo "Medium (200-1000ms): $medium_count endpoints"
  echo "Slow (>1000ms): $slow_count endpoints"

  echo ""
  echo "RECOMMENDATIONS:"
  echo "----------------"
  if (( slow_count > 0 )); then
    echo "- Consider optimizing slow endpoints (>1000ms)"
  fi
  if (( error_count > 0 )); then
    echo "- Investigate endpoints with errors"
  fi
  if (( avg_response_time > 500 )); then
    echo "- Consider implementing caching for frequently accessed data"
  fi

} > "$REPORT_FILE"

echo "Application performance monitoring completed."
echo "Report saved to: $REPORT_FILE"
echo "Prometheus metrics exported to: $PROMETHEUS_METRICS_FILE"

# Exit with error code if thresholds exceeded
if (( avg_response_time > THRESHOLD_RESPONSE_TIME )) || (( $(echo "$error_rate > $THRESHOLD_ERROR_RATE" | bc -l 2>/dev/null || echo "0") )); then
  echo "Performance thresholds exceeded. Check report for details."
  exit 1
fi