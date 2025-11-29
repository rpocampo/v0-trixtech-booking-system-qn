#!/bin/bash

# Auto-Scaling Orchestrator Script
# Scheduled execution every 2 minutes
# Decision making based on multiple metrics
# Integration with Prometheus metrics
# Notification of scaling events

set -e

# Source other scripts
source scripts/autoscaling/policies.sh
source scripts/autoscaling/limits.sh

# Configuration
INTERVAL="${INTERVAL:-120}"  # 2 minutes in seconds
SERVICES=("backend" "frontend")
NOTIFICATION_WEBHOOK="${NOTIFICATION_WEBHOOK:-}"

# Function to get metrics from monitor.sh
get_service_metrics() {
    local service=$1
    # This would call monitor.sh and parse output
    # For now, simulate by calling monitor functions directly
    local cpu=$(get_cpu_usage "$service")
    local mem=$(get_memory_usage "$service")
    local req=$(get_request_rate "$service")

    echo "$cpu $mem $req"
}

# Function to make scaling decision for service
make_scaling_decision() {
    local service=$1

    echo "Making scaling decision for $service"

    # Get metrics
    local metrics=$(get_service_metrics "$service")
    local cpu=$(echo "$metrics" | awk '{print $1}')
    local mem=$(echo "$metrics" | awk '{print $2}')
    local req=$(echo "$metrics" | awk '{print $3}')

    echo "Metrics - CPU: ${cpu}%, Memory: ${mem}%, Requests: ${req} req/min"

    # Apply policies
    local decision=$(combined_scaling_decision "$cpu" "$mem" "$req")

    echo "Initial decision: $decision"

    # Validate with limits and safety
    if [ "$decision" != "no_scale" ]; then
        local current_replicas=$(docker-compose ps "$service" | grep -c "Up" || echo "1")
        local desired_replicas

        if [ "$decision" = "scale_up" ]; then
            desired_replicas=$((current_replicas + 1))
        else
            desired_replicas=$((current_replicas - 1))
        fi

        # Validate request
        local validated_replicas=$(validate_scaling_request "$service" "$desired_replicas")
        if [ "$validated_replicas" != "$desired_replicas" ]; then
            if [ "$validated_replicas" = "" ]; then
                decision="no_scale"
                echo "Scaling request denied by safety checks"
            else
                desired_replicas=$validated_replicas
                echo "Scaling adjusted to $desired_replicas replicas"
            fi
        fi
    fi

    echo "$decision"
}

# Function to execute scaling
execute_scaling() {
    local service=$1
    local decision=$2

    if [ "$decision" != "no_scale" ]; then
        echo "Executing $decision for $service"

        # Call scale.sh
        if bash scripts/autoscaling/scale.sh "$service" "$decision"; then
            # Update load balancer
            bash scripts/autoscaling/load-balancer.sh "$service" "$decision"

            # Send notification
            send_notification "Scaling Event" "Service: $service, Action: $decision, Time: $(date)"
        else
            echo "Scaling failed for $service"
            send_notification "Scaling Failed" "Service: $service, Action: $decision failed"
        fi
    else
        echo "No scaling needed for $service"
    fi
}

# Function to send notification
send_notification() {
    local title=$1
    local message=$2

    if [ -n "$NOTIFICATION_WEBHOOK" ]; then
        curl -X POST "$NOTIFICATION_WEBHOOK" \
             -H "Content-Type: application/json" \
             -d "{\"title\": \"$title\", \"message\": \"$message\"}" \
             2>/dev/null || true
    fi

    # Log notification
    echo "[NOTIFICATION] $title: $message" >> scripts/autoscaling/notifications.log
}

# Function to perform orchestration cycle
orchestration_cycle() {
    echo "=== Starting Orchestration Cycle: $(date) ==="

    for service in "${SERVICES[@]}"; do
        echo "--- Processing $service ---"

        local decision=$(make_scaling_decision "$service")
        execute_scaling "$service" "$decision"

        echo ""
    done

    echo "=== Orchestration Cycle Complete ==="
}

# Function to run continuous orchestration
run_orchestrator() {
    echo "Starting Auto-Scaling Orchestrator (interval: ${INTERVAL}s)"

    while true; do
        orchestration_cycle
        sleep "$INTERVAL"
    done
}

# Function to run single cycle (for testing)
single_cycle() {
    echo "Running single orchestration cycle"
    orchestration_cycle
}

# Main execution
case "${1:-continuous}" in
    continuous)
        run_orchestrator
        ;;
    single)
        single_cycle
        ;;
    *)
        echo "Usage: $0 [continuous|single]"
        echo "  continuous: Run continuous orchestration (default)"
        echo "  single: Run single orchestration cycle"
        exit 1
        ;;
esac