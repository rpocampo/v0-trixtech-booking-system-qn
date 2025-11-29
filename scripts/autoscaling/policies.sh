#!/bin/bash

# Scaling Policies Script
# Defines scaling policies for CPU, memory, request-based, and time-based scaling

set -e

# Default thresholds (can be overridden by environment or config file)
CPU_SCALE_UP_THRESHOLD="${CPU_SCALE_UP_THRESHOLD:-70}"
CPU_SCALE_DOWN_THRESHOLD="${CPU_SCALE_DOWN_THRESHOLD:-30}"
MEM_SCALE_UP_THRESHOLD="${MEM_SCALE_UP_THRESHOLD:-80}"
MEM_SCALE_DOWN_THRESHOLD="${MEM_SCALE_DOWN_THRESHOLD:-40}"
REQ_SCALE_UP_THRESHOLD="${REQ_SCALE_UP_THRESHOLD:-100}"
REQ_SCALE_DOWN_THRESHOLD="${REQ_SCALE_DOWN_THRESHOLD:-20}"

# Time-based scaling multipliers
PEAK_HOURS_START="${PEAK_HOURS_START:-08:00}"
PEAK_HOURS_END="${PEAK_HOURS_END:-20:00}"
PEAK_MULTIPLIER="${PEAK_MULTIPLIER:-1.5}"

# Function to check if current time is peak hours
is_peak_hours() {
    local current_hour=$(date +%H:%M)
    local start=$PEAK_HOURS_START
    local end=$PEAK_HOURS_END

    # Simple time comparison (assumes same day)
    if [[ "$current_hour" > "$start" && "$current_hour" < "$end" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Function to get adjusted threshold based on time
get_adjusted_threshold() {
    local base_threshold=$1
    if [ "$(is_peak_hours)" = "true" ]; then
        # More aggressive scaling during peak hours
        echo "scale=2; ($base_threshold * $PEAK_MULTIPLIER)" | bc
    else
        echo "$base_threshold"
    fi
}

# CPU-based scaling policy
cpu_scaling_policy() {
    local cpu_usage=$1
    local scale_up_threshold=$(get_adjusted_threshold "$CPU_SCALE_UP_THRESHOLD")
    local scale_down_threshold=$(get_adjusted_threshold "$CPU_SCALE_DOWN_THRESHOLD")

    if (( $(echo "$cpu_usage > $scale_up_threshold" | bc -l) )); then
        echo "scale_up"
    elif (( $(echo "$cpu_usage < $scale_down_threshold" | bc -l) )); then
        echo "scale_down"
    else
        echo "no_scale"
    fi
}

# Memory-based scaling policy
memory_scaling_policy() {
    local mem_usage=$1
    local scale_up_threshold=$(get_adjusted_threshold "$MEM_SCALE_UP_THRESHOLD")
    local scale_down_threshold=$(get_adjusted_threshold "$MEM_SCALE_DOWN_THRESHOLD")

    if (( $(echo "$mem_usage > $scale_up_threshold" | bc -l) )); then
        echo "scale_up"
    elif (( $(echo "$mem_usage < $scale_down_threshold" | bc -l) )); then
        echo "scale_down"
    else
        echo "no_scale"
    fi
}

# Request-based scaling policy
request_scaling_policy() {
    local req_rate=$1
    local scale_up_threshold=$(get_adjusted_threshold "$REQ_SCALE_UP_THRESHOLD")
    local scale_down_threshold=$(get_adjusted_threshold "$REQ_SCALE_DOWN_THRESHOLD")

    if (( $(echo "$req_rate > $scale_up_threshold" | bc -l) )); then
        echo "scale_up"
    elif (( $(echo "$req_rate < $scale_down_threshold" | bc -l) )); then
        echo "scale_down"
    else
        echo "no_scale"
    fi
}

# Combined scaling decision based on multiple metrics
combined_scaling_decision() {
    local cpu=$1
    local mem=$2
    local req=$3

    local cpu_decision=$(cpu_scaling_policy "$cpu")
    local mem_decision=$(memory_scaling_policy "$mem")
    local req_decision=$(request_scaling_policy "$req")

    # Priority: scale_up if any metric requires it, otherwise scale_down if all agree, else no_scale
    if [ "$cpu_decision" = "scale_up" ] || [ "$mem_decision" = "scale_up" ] || [ "$req_decision" = "scale_up" ]; then
        echo "scale_up"
    elif [ "$cpu_decision" = "scale_down" ] && [ "$mem_decision" = "scale_down" ] && [ "$req_decision" = "scale_down" ]; then
        echo "scale_down"
    else
        echo "no_scale"
    fi
}

# Function to validate thresholds
validate_thresholds() {
    # Ensure scale up > scale down
    if [ "$CPU_SCALE_UP_THRESHOLD" -le "$CPU_SCALE_DOWN_THRESHOLD" ]; then
        echo "Error: CPU_SCALE_UP_THRESHOLD must be greater than CPU_SCALE_DOWN_THRESHOLD"
        exit 1
    fi
    if [ "$MEM_SCALE_UP_THRESHOLD" -le "$MEM_SCALE_DOWN_THRESHOLD" ]; then
        echo "Error: MEM_SCALE_UP_THRESHOLD must be greater than MEM_SCALE_DOWN_THRESHOLD"
        exit 1
    fi
    if [ "$REQ_SCALE_UP_THRESHOLD" -le "$REQ_SCALE_DOWN_THRESHOLD" ]; then
        echo "Error: REQ_SCALE_UP_THRESHOLD must be greater than REQ_SCALE_DOWN_THRESHOLD"
        exit 1
    fi
}

# Initialize and validate
validate_thresholds

# Export functions for use in other scripts
export -f is_peak_hours
export -f get_adjusted_threshold
export -f cpu_scaling_policy
export -f memory_scaling_policy
export -f request_scaling_policy
export -f combined_scaling_decision