#!/bin/bash

# Scaling Limits and Safety Script
# Manages minimum/maximum replica limits per service
# Handles emergency scale-down if resources are critically low
# Provides manual override capabilities
# Integrates with monitoring alerts

set -e

# Configuration
MIN_REPLICAS_BACKEND="${MIN_REPLICAS_BACKEND:-1}"
MAX_REPLICAS_BACKEND="${MAX_REPLICAS_BACKEND:-5}"
MIN_REPLICAS_FRONTEND="${MIN_REPLICAS_FRONTEND:-1}"
MAX_REPLICAS_FRONTEND="${MAX_REPLICAS_FRONTEND:-3}"

EMERGENCY_CPU_THRESHOLD="${EMERGENCY_CPU_THRESHOLD:-90}"
EMERGENCY_MEM_THRESHOLD="${EMERGENCY_MEM_THRESHOLD:-95}"
EMERGENCY_SCALE_DOWN_REPLICAS="${EMERGENCY_SCALE_DOWN_REPLICAS:-1}"

MANUAL_OVERRIDE_FILE="${MANUAL_OVERRIDE_FILE:-scripts/autoscaling/manual_override.txt}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

# Function to get min/max replicas for service
get_replica_limits() {
    local service=$1
    case $service in
        backend)
            echo "$MIN_REPLICAS_BACKEND $MAX_REPLICAS_BACKEND"
            ;;
        frontend)
            echo "$MIN_REPLICAS_FRONTEND $MAX_REPLICAS_FRONTEND"
            ;;
        *)
            echo "1 1"  # Default
            ;;
    esac
}

# Function to check if scaling is within limits
check_scaling_limits() {
    local service=$1
    local desired_replicas=$2

    local limits=$(get_replica_limits "$service")
    local min_replicas=$(echo "$limits" | awk '{print $1}')
    local max_replicas=$(echo "$limits" | awk '{print $2}')

    if [ "$desired_replicas" -lt "$min_replicas" ]; then
        echo "Desired replicas $desired_replicas below minimum $min_replicas for $service"
        return 1
    fi

    if [ "$desired_replicas" -gt "$max_replicas" ]; then
        echo "Desired replicas $desired_replicas above maximum $max_replicas for $service"
        return 1
    fi

    return 0
}

# Function to check for manual override
check_manual_override() {
    local service=$1

    if [ -f "$MANUAL_OVERRIDE_FILE" ]; then
        local override=$(grep "^$service:" "$MANUAL_OVERRIDE_FILE" | cut -d: -f2)
        if [ -n "$override" ]; then
            echo "Manual override active for $service: $override replicas"
            echo "$override"
            return 0
        fi
    fi

    echo ""
    return 1
}

# Function to set manual override
set_manual_override() {
    local service=$1
    local replicas=$2

    if check_scaling_limits "$service" "$replicas"; then
        # Remove existing override for service
        sed -i "/^$service:/d" "$MANUAL_OVERRIDE_FILE" 2>/dev/null || true
        echo "$service:$replicas" >> "$MANUAL_OVERRIDE_FILE"
        echo "Manual override set for $service: $replicas replicas"
        send_alert "Manual override activated" "Service: $service, Replicas: $replicas"
    else
        echo "Cannot set manual override: invalid replica count"
        return 1
    fi
}

# Function to clear manual override
clear_manual_override() {
    local service=$1

    sed -i "/^$service:/d" "$MANUAL_OVERRIDE_FILE" 2>/dev/null || true
    echo "Manual override cleared for $service"
    send_alert "Manual override cleared" "Service: $service"
}

# Function to check for emergency conditions
check_emergency_conditions() {
    # Check system-wide CPU and memory
    local system_cpu=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    local system_mem=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')

    if (( $(echo "$system_cpu > $EMERGENCY_CPU_THRESHOLD" | bc -l) )) || (( $(echo "$system_mem > $EMERGENCY_MEM_THRESHOLD" | bc -l) )); then
        echo "Emergency condition detected: CPU ${system_cpu}%, Memory ${system_mem}%"
        return 0
    fi

    return 1
}

# Function to perform emergency scale-down
emergency_scale_down() {
    local services=("backend" "frontend")

    echo "Performing emergency scale-down"

    for service in "${services[@]}"; do
        echo "Emergency scaling $service to $EMERGENCY_SCALE_DOWN_REPLICAS replicas"
        # Call scale.sh with emergency flag
        bash scripts/autoscaling/scale.sh "$service" "emergency_down"
        send_alert "Emergency Scale Down" "Service: $service scaled to $EMERGENCY_SCALE_DOWN_REPLICAS replicas due to critical resource usage"
    done
}

# Function to send alert
send_alert() {
    local title=$1
    local message=$2

    if [ -n "$ALERT_WEBHOOK_URL" ]; then
        curl -X POST "$ALERT_WEBHOOK_URL" \
             -H "Content-Type: application/json" \
             -d "{\"title\": \"$title\", \"message\": \"$message\"}" \
             2>/dev/null || true
    fi

    # Also log locally
    echo "[ALERT] $title: $message" >> scripts/autoscaling/alerts.log
}

# Function to validate scaling request
validate_scaling_request() {
    local service=$1
    local desired_replicas=$2

    # Check manual override first
    local override=$(check_manual_override "$service")
    if [ -n "$override" ]; then
        echo "Manual override active, using $override replicas instead of $desired_replicas"
        desired_replicas=$override
    fi

    # Check limits
    if ! check_scaling_limits "$service" "$desired_replicas"; then
        echo "Scaling request denied due to limits"
        return 1
    fi

    # Check emergency conditions
    if check_emergency_conditions; then
        echo "Emergency conditions detected, initiating emergency scale-down"
        emergency_scale_down
        return 1
    fi

    echo "$desired_replicas"
    return 0
}

# Main function for external calls
main() {
    local action=$1
    shift

    case $action in
        check_limits)
            local service=$1
            local replicas=$2
            check_scaling_limits "$service" "$replicas"
            ;;
        validate_request)
            local service=$1
            local replicas=$2
            validate_scaling_request "$service" "$replicas"
            ;;
        set_override)
            local service=$1
            local replicas=$2
            set_manual_override "$service" "$replicas"
            ;;
        clear_override)
            local service=$1
            clear_manual_override "$service"
            ;;
        emergency_check)
            if check_emergency_conditions; then
                emergency_scale_down
            else
                echo "No emergency conditions detected"
            fi
            ;;
        *)
            echo "Usage: $0 <action> [args...]"
            echo "Actions: check_limits <service> <replicas>, validate_request <service> <replicas>, set_override <service> <replicas>, clear_override <service>, emergency_check"
            exit 1
            ;;
    esac
}

# If script is called directly
if [ $# -gt 0 ]; then
    main "$@"
fi