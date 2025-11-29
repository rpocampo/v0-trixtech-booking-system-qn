#!/bin/bash

# Auto-Scaling Monitor Script
# Monitors CPU usage, memory usage, request rates, response times, and error rates
# Calculates scaling decisions based on configurable thresholds

set -e

# Configuration
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
THRESHOLDS_FILE="${THRESHOLDS_FILE:-scripts/autoscaling/thresholds.conf}"

# Load thresholds
if [ -f "$THRESHOLDS_FILE" ]; then
    source "$THRESHOLDS_FILE"
else
    # Default thresholds
    CPU_SCALE_UP=70
    CPU_SCALE_DOWN=30
    MEM_SCALE_UP=80
    MEM_SCALE_DOWN=40
    REQ_SCALE_UP=100
    REQ_SCALE_DOWN=20
    RESPONSE_TIME_THRESHOLD=2000  # ms
    ERROR_RATE_THRESHOLD=5        # %
fi

# Function to get CPU usage from Prometheus
get_cpu_usage() {
    local service=$1
    # Query Prometheus for average CPU usage over last 5 minutes
    local query="avg(rate(container_cpu_usage_seconds_total{name=~\"$service.*\"}[5m])) * 100"
    local result=$(curl -s "$PROMETHEUS_URL/api/v1/query" -d "query=$query" | jq -r '.data.result[0].value[1]')
    echo "${result:-0}"
}

# Function to get memory usage from Prometheus
get_memory_usage() {
    local service=$1
    # Query for memory usage percentage
    local query="(container_memory_usage_bytes{name=~\"$service.*\"} / container_spec_memory_limit_bytes{name=~\"$service.*\"}) * 100"
    local result=$(curl -s "$PROMETHEUS_URL/api/v1/query" -d "query=$query" | jq -r '.data.result[0].value[1]')
    echo "${result:-0}"
}

# Function to get request rate from Prometheus
get_request_rate() {
    local service=$1
    # Query for requests per minute
    local query="rate(http_requests_total{service=\"$service\"}[5m]) * 60"
    local result=$(curl -s "$PROMETHEUS_URL/api/v1/query" -d "query=$query" | jq -r '.data.result[0].value[1]')
    echo "${result:-0}"
}

# Function to get average response time
get_response_time() {
    local service=$1
    # Query for average response time
    local query="histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service=\"$service\"}[5m])) * 1000"
    local result=$(curl -s "$PROMETHEUS_URL/api/v1/query" -d "query=$query" | jq -r '.data.result[0].value[1]')
    echo "${result:-0}"
}

# Function to get error rate
get_error_rate() {
    local service=$1
    # Query for error rate percentage
    local query="(rate(http_requests_total{service=\"$service\",status=~\"5..\"}[5m]) / rate(http_requests_total{service=\"$service\"}[5m])) * 100"
    local result=$(curl -s "$PROMETHEUS_URL/api/v1/query" -d "query=$query" | jq -r '.data.result[0].value[1]')
    echo "${result:-0}"
}

# Function to calculate scaling decision
calculate_scaling_decision() {
    local service=$1
    local cpu=$(get_cpu_usage "$service")
    local mem=$(get_memory_usage "$service")
    local req=$(get_request_rate "$service")
    local resp_time=$(get_response_time "$service")
    local err_rate=$(get_error_rate "$service")

    echo "Service: $service"
    echo "CPU Usage: ${cpu}%"
    echo "Memory Usage: ${mem}%"
    echo "Request Rate: ${req} req/min"
    echo "Response Time: ${resp_time} ms"
    echo "Error Rate: ${err_rate}%"

    local decision="no_scale"

    # CPU-based scaling
    if (( $(echo "$cpu > $CPU_SCALE_UP" | bc -l) )); then
        decision="scale_up"
        echo "Decision: Scale up due to high CPU usage"
    elif (( $(echo "$cpu < $CPU_SCALE_DOWN" | bc -l) )); then
        decision="scale_down"
        echo "Decision: Scale down due to low CPU usage"
    fi

    # Memory-based scaling
    if (( $(echo "$mem > $MEM_SCALE_UP" | bc -l) )); then
        decision="scale_up"
        echo "Decision: Scale up due to high memory usage"
    elif (( $(echo "$mem < $MEM_SCALE_DOWN" | bc -l) )); then
        decision="scale_down"
        echo "Decision: Scale down due to low memory usage"
    fi

    # Request-based scaling
    if (( $(echo "$req > $REQ_SCALE_UP" | bc -l) )); then
        decision="scale_up"
        echo "Decision: Scale up due to high request rate"
    elif (( $(echo "$req < $REQ_SCALE_DOWN" | bc -l) )); then
        decision="scale_down"
        echo "Decision: Scale down due to low request rate"
    fi

    # Response time and error rate checks (for alerting, not direct scaling)
    if (( $(echo "$resp_time > $RESPONSE_TIME_THRESHOLD" | bc -l) )); then
        echo "Warning: High response time detected"
    fi

    if (( $(echo "$err_rate > $ERROR_RATE_THRESHOLD" | bc -l) )); then
        echo "Warning: High error rate detected"
    fi

    echo "$decision"
}

# Main monitoring function
monitor_services() {
    local services=("backend" "frontend")  # Add more services as needed

    for service in "${services[@]}"; do
        echo "=== Monitoring $service ==="
        calculate_scaling_decision "$service"
        echo ""
    done
}

# Run monitoring
monitor_services