#!/bin/bash

# TRIXTECH Booking System - Security Monitoring
# This script monitors for security events and anomalies:
# - Monitor for security events and anomalies
# - Track security metrics and trends
# - Alert on suspicious activities
# - Integration with SIEM systems

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
METRICS_DIR="$PROJECT_ROOT/metrics/security"
LOGS_DIR="$PROJECT_ROOT/logs"
ALERT_FILE="$LOGS_DIR/security_alerts_$TIMESTAMP.log"
METRICS_FILE="$METRICS_DIR/security_metrics_$TIMESTAMP.json"

# SIEM Configuration
SIEM_ENDPOINT="${SIEM_ENDPOINT:-}"
SIEM_API_KEY="${SIEM_API_KEY:-}"

# Thresholds for alerts
FAILED_LOGIN_THRESHOLD=5
SUSPICIOUS_REQUEST_THRESHOLD=10
ERROR_RATE_THRESHOLD=0.05

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create directories
mkdir -p "$METRICS_DIR"
mkdir -p "$LOGS_DIR"

# Function to send alert
send_alert() {
    local message=$1
    local severity=$2
    local event_type=$3

    echo "[$(date)] [$severity] [$event_type] $message" >> "$ALERT_FILE"

    # Send to notification service
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"TRIXTECH Security Alert [$severity]: $message\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi

    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "TRIXTECH Security Alert [$severity]" "$EMAIL_RECIPIENT" || true
    fi

    # Send to SIEM if configured
    if [ -n "$SIEM_ENDPOINT" ]; then
        SIEM_PAYLOAD='{
          "timestamp": "'$(date -Iseconds)'",
          "environment": "'$ENVIRONMENT'",
          "severity": "'$severity'",
          "event_type": "'$event_type'",
          "message": "'$message'",
          "source": "security-monitor.sh"
        }'

        curl -X POST "$SIEM_ENDPOINT" \
             -H "Content-Type: application/json" \
             -H "Authorization: Bearer $SIEM_API_KEY" \
             -d "$SIEM_PAYLOAD" || log_warn "Failed to send to SIEM"
    fi
}

# Function to collect metrics
collect_metrics() {
    local metric_name=$1
    local value=$2
    local unit=$3

    METRICS_DATA=$(echo "$METRICS_DATA" | jq ".metrics.$metric_name = {\"value\": $value, \"unit\": \"$unit\", \"timestamp\": \"$(date -Iseconds)\"}")
}

# Initialize metrics
METRICS_DATA='{
  "collection_timestamp": "'$(date -Iseconds)'",
  "environment": "'$ENVIRONMENT'",
  "metrics": {}
}'

log_info "Starting security monitoring..."

# 1. Monitor authentication events
log_info "Monitoring authentication events..."

# Check backend logs for failed logins
BACKEND_LOG="$LOGS_DIR/backend.log"
if [ -f "$BACKEND_LOG" ]; then
    FAILED_LOGINS=$(grep -c "Failed login\|Authentication failed\|Invalid credentials" "$BACKEND_LOG" 2>/dev/null || echo "0")
    collect_metrics "failed_logins_last_hour" "$FAILED_LOGINS" "count"

    if [ "$FAILED_LOGINS" -gt "$FAILED_LOGIN_THRESHOLD" ]; then
        send_alert "High number of failed login attempts: $FAILED_LOGINS in the last hour" "HIGH" "authentication"
    fi

    # Check for brute force patterns
    BRUTE_FORCE_IPS=$(grep "Failed login" "$BACKEND_LOG" | awk '{print $NF}' | sort | uniq -c | sort -nr | head -5)
    if [ -n "$BRUTE_FORCE_IPS" ]; then
        send_alert "Potential brute force attack detected from IPs: $BRUTE_FORCE_IPS" "CRITICAL" "brute_force"
    fi
else
    log_warn "Backend log file not found: $BACKEND_LOG"
fi

# 2. Monitor for suspicious requests
log_info "Monitoring for suspicious requests..."

# Check for SQL injection patterns
if [ -f "$BACKEND_LOG" ]; then
    SQL_INJECTION=$(grep -c -i "union\|select.*from\|drop\|exec\|xp_" "$BACKEND_LOG" 2>/dev/null || echo "0")
    collect_metrics "sql_injection_attempts" "$SQL_INJECTION" "count"

    if [ "$SQL_INJECTION" -gt 0 ]; then
        send_alert "Potential SQL injection attempts detected: $SQL_INJECTION" "CRITICAL" "sql_injection"
    fi

    # Check for XSS patterns
    XSS_ATTEMPTS=$(grep -c -i "<script\|javascript:\|onload\|onerror" "$BACKEND_LOG" 2>/dev/null || echo "0")
    collect_metrics "xss_attempts" "$XSS_ATTEMPTS" "count"

    if [ "$XSS_ATTEMPTS" -gt 0 ]; then
        send_alert "Potential XSS attempts detected: $XSS_ATTEMPTS" "HIGH" "xss"
    fi
fi

# 3. Monitor error rates
log_info "Monitoring error rates..."

if [ -f "$BACKEND_LOG" ]; then
    TOTAL_REQUESTS=$(grep -c "REQUEST\|GET\|POST" "$BACKEND_LOG" 2>/dev/null || echo "1")
    ERROR_REQUESTS=$(grep -c "ERROR\|500\|Exception" "$BACKEND_LOG" 2>/dev/null || echo "0")

    if [ "$TOTAL_REQUESTS" -gt 0 ]; then
        ERROR_RATE=$(echo "scale=4; $ERROR_REQUESTS / $TOTAL_REQUESTS" | bc 2>/dev/null || echo "0")
        collect_metrics "error_rate" "$ERROR_RATE" "ratio"

        if (( $(echo "$ERROR_RATE > $ERROR_RATE_THRESHOLD" | bc -l 2>/dev/null || echo "0") )); then
            send_alert "High error rate detected: $(echo "scale=2; $ERROR_RATE * 100" | bc)% ($ERROR_REQUESTS/$TOTAL_REQUESTS)" "MEDIUM" "error_rate"
        fi
    fi
fi

# 4. Monitor system resources for anomalies
log_info "Monitoring system resources..."

# Check disk usage
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
collect_metrics "disk_usage_percent" "$DISK_USAGE" "percent"

if [ "$DISK_USAGE" -gt 90 ]; then
    send_alert "High disk usage: $DISK_USAGE%" "MEDIUM" "system"
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
collect_metrics "memory_usage_percent" "$MEM_USAGE" "percent"

if [ "$MEM_USAGE" -gt 90 ]; then
    send_alert "High memory usage: $MEM_USAGE%" "MEDIUM" "system"
fi

# 5. Monitor for unusual network activity
log_info "Monitoring network activity..."

# Check for unusual number of connections
if command -v netstat &> /dev/null; then
    ACTIVE_CONNECTIONS=$(netstat -tun | grep ESTABLISHED | wc -l)
    collect_metrics "active_connections" "$ACTIVE_CONNECTIONS" "count"

    if [ "$ACTIVE_CONNECTIONS" -gt 1000 ]; then
        send_alert "Unusually high number of active connections: $ACTIVE_CONNECTIONS" "MEDIUM" "network"
    fi
fi

# 6. Check for security-related file changes
log_info "Checking for security-related file changes..."

# Monitor critical files for changes
CRITICAL_FILES=(
    "$PROJECT_ROOT/backend/.env"
    "$PROJECT_ROOT/frontend/.env"
    "$PROJECT_ROOT/package.json"
    "$PROJECT_ROOT/docker-compose.yml"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        FILE_MOD_TIME=$(stat -c %Y "$file" 2>/dev/null || stat -f %m "$file" 2>/dev/null || echo "0")
        LAST_CHECK_FILE="$METRICS_DIR/$(basename "$file").last_check"

        if [ -f "$LAST_CHECK_FILE" ]; then
            LAST_CHECK_TIME=$(cat "$LAST_CHECK_FILE")
            if [ "$FILE_MOD_TIME" -gt "$LAST_CHECK_TIME" ]; then
                send_alert "Critical file modified: $file" "MEDIUM" "file_change"
            fi
        fi

        echo "$FILE_MOD_TIME" > "$LAST_CHECK_FILE"
    fi
done

# 7. Track security metrics trends
log_info "Tracking security metrics trends..."

# Compare with previous metrics
PREVIOUS_METRICS_FILE=$(ls -t "$METRICS_DIR"/security_metrics_*.json 2>/dev/null | head -2 | tail -1)
if [ -f "$PREVIOUS_METRICS_FILE" ]; then
    PREV_FAILED_LOGINS=$(jq '.metrics.failed_logins_last_hour.value // 0' "$PREVIOUS_METRICS_FILE" 2>/dev/null || echo "0")
    CURRENT_FAILED_LOGINS=$(jq '.metrics.failed_logins_last_hour.value // 0' <<< "$METRICS_DATA" 2>/dev/null || echo "0")

    if [ "$CURRENT_FAILED_LOGINS" -gt $((PREV_FAILED_LOGINS * 2)) ]; then
        send_alert "Sudden increase in failed logins: $CURRENT_FAILED_LOGINS (previous: $PREV_FAILED_LOGINS)" "HIGH" "trend"
    fi
fi

# Save metrics
echo "$METRICS_DATA" > "$METRICS_FILE"

log_info "Security monitoring completed."
log_info "Metrics saved to: $METRICS_FILE"

if [ -f "$ALERT_FILE" ]; then
    ALERT_COUNT=$(wc -l < "$ALERT_FILE")
    log_info "Security alerts generated: $ALERT_COUNT"
    log_info "Alerts saved to: $ALERT_FILE"
else
    log_info "No security alerts generated."
fi

# Clean up old metrics (keep last 30 days)
find "$METRICS_DIR" -name "security_metrics_*.json" -mtime +30 -delete 2>/dev/null || true
find "$LOGS_DIR" -name "security_alerts_*.log" -mtime +30 -delete 2>/dev/null || true