#!/bin/bash

# Load Balancer Integration Script
# Updates Nginx configuration for new replicas
# Performs health checks for new instances before adding to load balancer
# Handles graceful removal of instances during scale-down

set -e

# Configuration
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
NGINX_CONFIG_DIR="${NGINX_CONFIG_DIR:-nginx}"
NGINX_CONTAINER="${NGINX_CONTAINER:-nginx}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-30}"

# Function to get service container IPs and ports
get_service_instances() {
    local service=$1
    docker-compose -f "$COMPOSE_FILE" ps "$service" | grep "Up" | awk '{print $1}' | xargs -I {} docker inspect {} --format '{{.NetworkSettings.Networks.trixtech_default.IPAddress}}:{{(index .Config.ExposedPorts)}}' | sed 's/map\[/:/' | sed 's/\]//' | sed 's/:/ /' | awk '{print $1}'
}

# Function to perform health check on instance
health_check_instance() {
    local ip_port=$1
    local ip=$(echo "$ip_port" | cut -d: -f1)
    local port=$(echo "$ip_port" | cut -d: -f2)

    echo "Performing health check on $ip:$port"

    local start_time=$(date +%s)
    while true; do
        if curl -f -s "http://$ip:$port$HEALTH_CHECK_URL" > /dev/null 2>&1; then
            echo "Health check passed for $ip:$port"
            return 0
        fi

        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))

        if [ $elapsed -gt $HEALTH_CHECK_TIMEOUT ]; then
            echo "Health check failed for $ip:$port after $HEALTH_CHECK_TIMEOUT seconds"
            return 1
        fi

        sleep 2
    done
}

# Function to update Nginx upstream configuration
update_nginx_upstream() {
    local service=$1
    local upstream_name="${service}_upstream"
    local config_file="$NGINX_CONFIG_DIR/upstreams/${upstream_name}.conf"

    echo "Updating Nginx upstream for $service"

    # Get current instances
    local instances=$(get_service_instances "$service")
    local upstream_servers=""

    for instance in $instances; do
        if health_check_instance "$instance"; then
            local ip=$(echo "$instance" | cut -d: -f1)
            local port=$(echo "$instance" | cut -d: -f2)
            upstream_servers="${upstream_servers}server ${ip}:${port};\n    "
        else
            echo "Skipping unhealthy instance: $instance"
        fi
    done

    # Generate upstream config
    cat > "$config_file" << EOF
upstream ${upstream_name} {
    ${upstream_servers}
}
EOF

    echo "Updated upstream config for $service with $(echo "$upstream_servers" | wc -l) servers"
}

# Function to reload Nginx configuration
reload_nginx() {
    echo "Reloading Nginx configuration"
    docker-compose -f "$COMPOSE_FILE" exec -T "$NGINX_CONTAINER" nginx -s reload
}

# Function to gracefully remove instance from load balancer
graceful_remove_instance() {
    local service=$1
    local instance_ip=$2

    echo "Gracefully removing $instance_ip from $service load balancer"

    # Mark instance as draining (if supported by load balancer)
    # For Nginx, we can remove it from upstream and reload
    update_nginx_upstream "$service"
    reload_nginx

    # Wait for existing connections to drain (optional)
    sleep 10

    echo "Instance $instance_ip removed from load balancer"
}

# Function to add instance to load balancer
add_instance_to_lb() {
    local service=$1
    local instance_ip=$2

    echo "Adding $instance_ip to $service load balancer"

    # Health check before adding
    if health_check_instance "$instance_ip"; then
        update_nginx_upstream "$service"
        reload_nginx
        echo "Instance $instance_ip added to load balancer"
    else
        echo "Failed to add unhealthy instance $instance_ip to load balancer"
        return 1
    fi
}

# Function to handle scaling event
handle_scaling_event() {
    local service=$1
    local action=$2  # scale_up or scale_down

    case $action in
        scale_up)
            echo "Handling scale up for $service"
            # The scaling is already done by scale.sh, now update LB
            update_nginx_upstream "$service"
            reload_nginx
            ;;
        scale_down)
            echo "Handling scale down for $service"
            # Instances are being removed, update LB
            update_nginx_upstream "$service"
            reload_nginx
            ;;
        *)
            echo "Unknown scaling action: $action"
            ;;
    esac
}

# Main function
main() {
    local service=$1
    local action=$2

    if [ -z "$service" ] || [ -z "$action" ]; then
        echo "Usage: $0 <service> <action>"
        echo "Actions: scale_up, scale_down, update"
        exit 1
    fi

    handle_scaling_event "$service" "$action"
}

# If script is called directly
if [ $# -eq 2 ]; then
    main "$1" "$2"
fi