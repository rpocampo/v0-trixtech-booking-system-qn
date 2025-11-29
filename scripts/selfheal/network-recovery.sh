#!/bin/bash

# TRIXTECH Booking System - Network Connectivity Recovery
# Tests external service connectivity, restarts network services on failure,
# updates DNS configurations, and handles VPN/proxy issues.

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/../config/selfheal.conf"
LOG_FILE="${SCRIPT_DIR}/../logs/network-recovery.log"
CONNECTIVITY_TIMEOUT=10  # seconds
MAX_RETRIES=3
EXTERNAL_SERVICES=(
    "smtp.gmail.com:587:email"
    "api.paypal.com:443:payment"
    "api.stripe.com:443:payment"
    "8.8.8.8:53:dns"
)
DNS_SERVERS=("8.8.8.8" "1.1.1.1" "208.67.222.222")
ALERT_EMAIL="admin@trixtech.com"

# Load environment-specific configuration
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    echo "[$timestamp] [$level] $message"
}

# Alert function
alert() {
    local message="$1"
    log "ALERT" "$message"
    # Integrate with monitoring system
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "TRIXTECH Network Recovery Alert" "$ALERT_EMAIL"
    fi
}

# Test connectivity to a host:port
test_connectivity() {
    local host="$1"
    local port="$2"
    local service="$3"

    if timeout "$CONNECTIVITY_TIMEOUT" bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        log "INFO" "Connectivity to $service ($host:$port) is OK"
        return 0
    else
        log "WARN" "Connectivity to $service ($host:$port) failed"
        return 1
    fi
}

# Test DNS resolution
test_dns() {
    local domain="google.com"
    if nslookup "$domain" >/dev/null 2>&1; then
        log "INFO" "DNS resolution working"
        return 0
    else
        log "WARN" "DNS resolution failed"
        return 1
    fi
}

# Update DNS configuration
update_dns_config() {
    log "INFO" "Updating DNS configuration"

    local resolv_conf="/etc/resolv.conf"
    local backup="${resolv_conf}.backup.$(date +%Y%m%d_%H%M%S)"

    # Backup current config
    cp "$resolv_conf" "$backup" 2>/dev/null || true

    # Update with reliable DNS servers
    {
        echo "# Updated by TRIXTECH network recovery $(date)"
        for dns in "${DNS_SERVERS[@]}"; do
            echo "nameserver $dns"
        done
    } > "$resolv_conf"

    log "INFO" "DNS configuration updated, backup saved to $backup"
}

# Restart network services
restart_network_services() {
    log "INFO" "Restarting network-related services"

    local services=("networking" "NetworkManager" "systemd-networkd" "docker")
    local restarted=()

    for service in "${services[@]}"; do
        if systemctl is-active --quiet "$service" 2>/dev/null; then
            if systemctl restart "$service" 2>/dev/null; then
                restarted+=("$service")
                log "INFO" "Restarted service: $service"
                sleep 5  # Wait for service to start
            else
                log "WARN" "Failed to restart service: $service"
            fi
        fi
    done

    if (( ${#restarted[@]} > 0 )); then
        log "INFO" "Restarted services: ${restarted[*]}"
    fi
}

# Handle VPN connectivity
handle_vpn_connectivity() {
    log "INFO" "Checking VPN connectivity"

    # Check if VPN is configured and should be running
    if command -v nmcli >/dev/null 2>&1; then
        local vpn_connections=$(nmcli connection show --active | grep vpn | wc -l)
        if (( vpn_connections == 0 )); then
            log "INFO" "No active VPN connections"
            return 0
        fi

        # Try to restart VPN connections
        nmcli connection show --active | grep vpn | awk '{print $1}' | while read -r conn; do
            log "INFO" "Restarting VPN connection: $conn"
            nmcli connection down "$conn" && sleep 2 && nmcli connection up "$conn"
        done
    fi
}

# Handle proxy settings
handle_proxy_settings() {
    log "INFO" "Checking proxy configuration"

    # Check environment variables
    local proxy_vars=("http_proxy" "https_proxy" "ftp_proxy" "no_proxy")
    local proxy_issues=()

    for var in "${proxy_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            # Test proxy connectivity
            if ! curl -s --max-time 5 --proxy "${!var}" http://httpbin.org/ip >/dev/null 2>&1; then
                proxy_issues+=("$var=${!var}")
            fi
        fi
    done

    if (( ${#proxy_issues[@]} > 0 )); then
        alert "Proxy connectivity issues detected: ${proxy_issues[*]}"
        # Could attempt to update proxy settings or alert for manual intervention
    fi
}

# Perform connectivity tests with retries
test_with_retries() {
    local host="$1"
    local port="$2"
    local service="$3"
    local attempt=1

    while (( attempt <= MAX_RETRIES )); do
        if test_connectivity "$host" "$port" "$service"; then
            return 0
        fi
        ((attempt++))
        sleep 2
    done

    return 1
}

# Manual override check
check_manual_override() {
    local override_file="${SCRIPT_DIR}/../flags/network-recovery.override"
    if [[ -f "$override_file" ]]; then
        log "INFO" "Manual override detected, skipping network recovery"
        return 0
    fi
    return 1
}

# Cleanup old logs
cleanup_logs() {
    # Keep logs for 30 days
    find "${SCRIPT_DIR}/../logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
}

# Main function
main() {
    log "INFO" "Starting TRIXTECH Network Recovery"

    # Create directories
    mkdir -p "${SCRIPT_DIR}/../logs"
    mkdir -p "${SCRIPT_DIR}/../config"
    mkdir -p "${SCRIPT_DIR}/../flags"

    # Cleanup old logs
    cleanup_logs

    # Check for manual override
    if check_manual_override; then
        log "INFO" "Exiting due to manual override"
        exit 0
    fi

    local failures=()

    # Test DNS first
    if ! test_dns; then
        update_dns_config
        sleep 5
        if ! test_dns; then
            failures+=("DNS")
        fi
    fi

    # Test external services
    for service_info in "${EXTERNAL_SERVICES[@]}"; do
        IFS=':' read -r host port service <<< "$service_info"
        if ! test_with_retries "$host" "$port" "$service"; then
            failures+=("$service ($host:$port)")
        fi
    done

    # If there are connectivity failures, attempt recovery
    if (( ${#failures[@]} > 0 )); then
        log "WARN" "Connectivity failures detected: ${failures[*]}"

        # Attempt recovery steps
        handle_vpn_connectivity
        handle_proxy_settings
        restart_network_services

        # Test again after recovery
        sleep 10
        local remaining_failures=()
        for service_info in "${EXTERNAL_SERVICES[@]}"; do
            IFS=':' read -r host port service <<< "$service_info"
            if ! test_connectivity "$host" "$port" "$service"; then
                remaining_failures+=("$service ($host:$port)")
            fi
        done

        if (( ${#remaining_failures[@]} > 0 )); then
            alert "Network recovery failed for: ${remaining_failures[*]} - manual intervention required"
        else
            log "INFO" "Network recovery successful"
        fi
    else
        log "INFO" "All network connectivity tests passed"
    fi
}

# Run main function
main "$@"