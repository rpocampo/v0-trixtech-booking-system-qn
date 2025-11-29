#!/bin/bash

# Scaling Engine Script
# Scales backend services (1-5 replicas) and frontend services (1-3 replicas)
# Implements cooldown periods to prevent thrashing
# Logs all scaling actions with reasons

set -e

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
LOG_FILE="${LOG_FILE:-scripts/autoscaling/scaling.log}"
COOLDOWN_PERIOD="${COOLDOWN_PERIOD:-300}"  # 5 minutes in seconds
LAST_SCALE_FILE="${LAST_SCALE_FILE:-scripts/autoscaling/last_scale.txt}"

# Function to log scaling actions
log_scaling_action() {
    local service=$1
    local action=$2
    local reason=$3
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] Scaling $service: $action - Reason: $reason" >> "$LOG_FILE"
}

# Function to check cooldown period
check_cooldown() {
    local service=$1
    if [ -f "$LAST_SCALE_FILE" ]; then
        local last_scale=$(grep "^$service:" "$LAST_SCALE_FILE" | cut -d: -f2)
        if [ -n "$last_scale" ]; then
            local current_time=$(date +%s)
            local time_diff=$((current_time - last_scale))
            if [ $time_diff -lt $COOLDOWN_PERIOD ]; then
                echo "Cooldown period not elapsed for $service. Last scaled $time_diff seconds ago."
                return 1
            fi
        fi
    fi
    return 0
}

# Function to update last scale time
update_last_scale() {
    local service=$1
    local timestamp=$(date +%s)
    # Remove existing entry for service
    sed -i "/^$service:/d" "$LAST_SCALE_FILE" 2>/dev/null || true
    echo "$service:$timestamp" >> "$LAST_SCALE_FILE"
}

# Function to get current replica count
get_current_replicas() {
    local service=$1
    docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -c "Up" || echo "0"
}

# Function to scale service
scale_service() {
    local service=$1
    local direction=$2  # up or down
    local reason=$3

    if ! check_cooldown "$service"; then
        echo "Skipping scale for $service due to cooldown."
        return 1
    fi

    local current_replicas=$(get_current_replicas "$service")
    local new_replicas

    case $service in
        backend)
            if [ "$direction" = "up" ] && [ $current_replicas -lt 5 ]; then
                new_replicas=$((current_replicas + 1))
            elif [ "$direction" = "down" ] && [ $current_replicas -gt 1 ]; then
                new_replicas=$((current_replicas - 1))
            else
                echo "Cannot scale $service $direction. Current: $current_replicas"
                return 1
            fi
            ;;
        frontend)
            if [ "$direction" = "up" ] && [ $current_replicas -lt 3 ]; then
                new_replicas=$((current_replicas + 1))
            elif [ "$direction" = "down" ] && [ $current_replicas -gt 1 ]; then
                new_replicas=$((current_replicas - 1))
            else
                echo "Cannot scale $service $direction. Current: $current_replicas"
                return 1
            fi
            ;;
        *)
            echo "Unknown service: $service"
            return 1
            ;;
    esac

    echo "Scaling $service from $current_replicas to $new_replicas replicas"

    # Perform scaling
    docker-compose -f "$COMPOSE_FILE" up -d --scale "$service=$new_replicas" "$service"

    # Wait for containers to be ready
    sleep 10

    # Verify scaling
    local actual_replicas=$(get_current_replicas "$service")
    if [ "$actual_replicas" -eq "$new_replicas" ]; then
        log_scaling_action "$service" "$direction to $new_replicas" "$reason"
        update_last_scale "$service"
        echo "Successfully scaled $service to $new_replicas replicas"
    else
        echo "Failed to scale $service. Expected: $new_replicas, Actual: $actual_replicas"
        return 1
    fi
}

# Function to scale up
scale_up() {
    local service=$1
    local reason=$2
    scale_service "$service" "up" "$reason"
}

# Function to scale down
scale_down() {
    local service=$1
    local reason=$2
    scale_service "$service" "down" "$reason"
}

# Main scaling function (called by orchestrator)
perform_scaling() {
    local service=$1
    local decision=$2

    case $decision in
        scale_up)
            scale_up "$service" "High load detected"
            ;;
        scale_down)
            scale_down "$service" "Low load detected"
            ;;
        no_scale)
            echo "No scaling needed for $service"
            ;;
        *)
            echo "Unknown decision: $decision"
            ;;
    esac
}

# If script is called directly with arguments
if [ $# -eq 2 ]; then
    perform_scaling "$1" "$2"
fi