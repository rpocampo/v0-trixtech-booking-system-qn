#!/bin/bash

# TRIXTECH Performance Alerting System
# Monitors performance thresholds, alerts on degradation, generates incident reports

set -e

# Configuration
ENV=${ENV:-dev}
REPORT_DIR=${REPORT_DIR:-reports}
ALERT_DIR=${ALERT_DIR:-alerts}
THRESHOLD_CPU=${THRESHOLD_CPU:-80}
THRESHOLD_MEMORY=${THRESHOLD_MEMORY:-85}
THRESHOLD_DISK=${THRESHOLD_DISK:-90}
THRESHOLD_RESPONSE_TIME=${THRESHOLD_RESPONSE_TIME:-1000}
THRESHOLD_ERROR_RATE=${THRESHOLD_ERROR_RATE:-0.05}
THRESHOLD_DB_CONNECTIONS=${THRESHOLD_DB_CONNECTIONS:-100}
THRESHOLD_DB_SLOW_QUERIES=${THRESHOLD_DB_SLOW_QUERIES:-10}

# Alerting configuration
ALERT_EMAIL=${ALERT_EMAIL:-admin@trixtech.com}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}
PROMETHEUS_PUSHGATEWAY=${PROMETHEUS_PUSHGATEWAY:-}

# Create directories
mkdir -p "$REPORT_DIR" "$ALERT_DIR"

# Current timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
ALERT_FILE="$ALERT_DIR/performance_alert_$TIMESTAMP.txt"
INCIDENT_REPORT="$REPORT_DIR/incident_report_$TIMESTAMP.txt"

# Global alert status
ALERTS_TRIGGERED=0
ALERT_MESSAGES=""

# Function to log alerts
log_alert() {
  local level=$1
  local message=$2
  local component=$3

  echo "$(date '+%Y-%m-%d %H:%M:%S') [$level] $component: $message" >> "$ALERT_FILE"
  ALERT_MESSAGES="${ALERT_MESSAGES}[$level] $component: $message\n"

  if [ "$level" = "CRITICAL" ] || [ "$level" = "WARNING" ]; then
    ((ALERTS_TRIGGERED++))
  fi
}

# Function to check system metrics
check_system_alerts() {
  log_alert "INFO" "Checking system performance metrics" "SYSTEM"

  # Get current metrics (simplified - in practice, read from monitoring system)
  cpu_usage=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}' 2>/dev/null || echo "0")
  memory_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}' 2>/dev/null || echo "0")
  disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "0")

  if (( $(echo "$cpu_usage > $THRESHOLD_CPU" | bc -l 2>/dev/null) )); then
    log_alert "CRITICAL" "CPU usage is ${cpu_usage}% (threshold: ${THRESHOLD_CPU}%)" "SYSTEM"
  elif (( $(echo "$cpu_usage > $((THRESHOLD_CPU - 10))" | bc -l 2>/dev/null) )); then
    log_alert "WARNING" "CPU usage is ${cpu_usage}% approaching threshold" "SYSTEM"
  fi

  if (( $(echo "$memory_usage > $THRESHOLD_MEMORY" | bc -l 2>/dev/null) )); then
    log_alert "CRITICAL" "Memory usage is ${memory_usage}% (threshold: ${THRESHOLD_MEMORY}%)" "SYSTEM"
  elif (( $(echo "$memory_usage > $((THRESHOLD_MEMORY - 10))" | bc -l 2>/dev/null) )); then
    log_alert "WARNING" "Memory usage is ${memory_usage}% approaching threshold" "SYSTEM"
  fi

  if (( $(echo "$disk_usage > $THRESHOLD_DISK" | bc -l 2>/dev/null) )); then
    log_alert "CRITICAL" "Disk usage is ${disk_usage}% (threshold: ${THRESHOLD_DISK}%)" "SYSTEM"
  elif (( $(echo "$disk_usage > $((THRESHOLD_DISK - 10))" | bc -l 2>/dev/null) )); then
    log_alert "WARNING" "Disk usage is ${disk_usage}% approaching threshold" "SYSTEM"
  fi
}

# Function to check application metrics
check_application_alerts() {
  log_alert "INFO" "Checking application performance metrics" "APPLICATION"

  # Simulate checking app metrics (in practice, read from Prometheus or logs)
  # For demo, check if app is responding
  if curl -s --max-time 5 http://localhost:5000/health >/dev/null 2>&1; then
    log_alert "INFO" "Application health check passed" "APPLICATION"
  else
    log_alert "CRITICAL" "Application health check failed - service may be down" "APPLICATION"
  fi

  # Check response times (mock values - replace with real monitoring)
  avg_response_time=450  # Mock value
  error_rate=0.02        # Mock value

  if (( $(echo "$avg_response_time > $THRESHOLD_RESPONSE_TIME" | bc -l 2>/dev/null) )); then
    log_alert "WARNING" "Average response time is ${avg_response_time}ms (threshold: ${THRESHOLD_RESPONSE_TIME}ms)" "APPLICATION"
  fi

  error_rate_percent=$(echo "scale=2; $error_rate * 100" | bc 2>/dev/null || echo "0")
  threshold_percent=$(echo "scale=2; $THRESHOLD_ERROR_RATE * 100" | bc 2>/dev/null || echo "5.00")
  if (( $(echo "$error_rate > $THRESHOLD_ERROR_RATE" | bc -l 2>/dev/null) )); then
    log_alert "CRITICAL" "Error rate is ${error_rate_percent}% (threshold: ${threshold_percent}%)" "APPLICATION"
  fi
}

# Function to check database metrics
check_database_alerts() {
  log_alert "INFO" "Checking database performance metrics" "DATABASE"

  # Check MongoDB connection
  if command -v mongosh >/dev/null 2>&1 || command -v mongo >/dev/null 2>&1; then
    if mongo_cmd "db.runCommand('ping')" >/dev/null 2>&1; then
      log_alert "INFO" "Database connection healthy" "DATABASE"
    else
      log_alert "CRITICAL" "Database connection failed" "DATABASE"
    fi

    # Check connection count
    connections=$(mongo_cmd "db.serverStatus().connections.current" 2>/dev/null || echo "0")
    if (( connections > THRESHOLD_DB_CONNECTIONS )); then
      log_alert "WARNING" "Database connections: $connections (threshold: $THRESHOLD_DB_CONNECTIONS)" "DATABASE"
    fi

    # Check slow queries
    slow_queries=$(mongo_cmd "db.system.profile.count({millis: {\$gt: 100}})" 2>/dev/null || echo "0")
    if (( slow_queries > THRESHOLD_DB_SLOW_QUERIES )); then
      log_alert "WARNING" "Slow queries detected: $slow_queries (threshold: $THRESHOLD_DB_SLOW_QUERIES)" "DATABASE"
    fi
  else
    log_alert "WARNING" "MongoDB client not available for monitoring" "DATABASE"
  fi
}

# Function to send email alert
send_email_alert() {
  local subject="TRIXTECH Performance Alert - $ENV Environment"
  local body="Performance alerts have been triggered in the $ENV environment.

Alert Details:
$ALERT_MESSAGES

Please check the incident report: $INCIDENT_REPORT
Alert log: $ALERT_FILE

Timestamp: $(date)
Environment: $ENV
"

  if command -v mail >/dev/null 2>&1; then
    echo -e "$body" | mail -s "$subject" "$ALERT_EMAIL"
    log_alert "INFO" "Email alert sent to $ALERT_EMAIL" "ALERTING"
  else
    log_alert "WARNING" "Mail command not available, email not sent" "ALERTING"
  fi
}

# Function to send Slack alert
send_slack_alert() {
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    local payload="{
      \"text\": \"🚨 TRIXTECH Performance Alert - $ENV Environment\",
      \"blocks\": [
        {
          \"type\": \"section\",
          \"text\": {
            \"type\": \"mrkdwn\",
            \"text\": \"Performance alerts triggered in $ENV environment\"
          }
        },
        {
          \"type\": \"section\",
          \"text\": {
            \"type\": \"mrkdwn\",
            \"text\": \"$ALERT_MESSAGES\"
          }
        }
      ]
    }"

    if curl -s -X POST -H 'Content-type: application/json' --data "$payload" "$SLACK_WEBHOOK_URL" >/dev/null 2>&1; then
      log_alert "INFO" "Slack alert sent" "ALERTING"
    else
      log_alert "WARNING" "Failed to send Slack alert" "ALERTING"
    fi
  fi
}

# Function to push metrics to Prometheus Pushgateway
push_prometheus_alerts() {
  if [ -n "$PROMETHEUS_PUSHGATEWAY" ]; then
    local metrics="trixtech_alerts_total{env=\"$ENV\"} $ALERTS_TRIGGERED\n"

    if echo -e "$metrics" | curl -s --data-binary @- "$PROMETHEUS_PUSHGATEWAY/metrics/job/performance_alerts/env/$ENV" >/dev/null 2>&1; then
      log_alert "INFO" "Metrics pushed to Prometheus Pushgateway" "ALERTING"
    else
      log_alert "WARNING" "Failed to push metrics to Prometheus" "ALERTING"
    fi
  fi
}

# Function to generate incident report
generate_incident_report() {
  {
    echo "========================================"
    echo "TRIXTECH Performance Incident Report"
    echo "========================================"
    echo "Incident ID: PERF_$TIMESTAMP"
    echo "Generated: $(date)"
    echo "Environment: $ENV"
    echo "Alerts Triggered: $ALERTS_TRIGGERED"
    echo ""
    echo "ALERT SUMMARY:"
    echo "--------------"
    echo -e "$ALERT_MESSAGES"
    echo ""
    echo "SYSTEM INFORMATION:"
    echo "------------------"
    echo "Hostname: $(hostname)"
    echo "Uptime: $(uptime)"
    echo "Load Average: $(uptime | awk -F'load average:' '{ print $2 }')"
    echo ""
    echo "RECOMMENDED ACTIONS:"
    echo "-------------------"
    if (( ALERTS_TRIGGERED > 0 )); then
      echo "1. Review detailed logs in: $ALERT_FILE"
      echo "2. Check system resources and processes"
      echo "3. Verify application and database connectivity"
      echo "4. Consider running automated optimization: ./auto-optimize.sh"
      echo "5. Escalate to on-call engineer if critical alerts persist"
    else
      echo "No immediate action required - all systems normal"
    fi
    echo ""
    echo "MONITORING FILES:"
    echo "-----------------"
    echo "Alert Log: $ALERT_FILE"
    echo "System Report: $REPORT_DIR/system_performance_$(date +%Y%m%d)*.txt"
    echo "Database Report: $REPORT_DIR/db_performance_$(date +%Y%m%d)*.txt"
    echo "Application Report: $REPORT_DIR/app_performance_$(date +%Y%m%d)*.txt"
  } > "$INCIDENT_REPORT"
}

# Function to execute MongoDB command
mongo_cmd() {
  local cmd=$1
  if command -v mongosh >/dev/null 2>&1; then
    mongosh "mongodb://localhost:27017/trixtech" --quiet --eval "$cmd" 2>/dev/null
  elif command -v mongo >/dev/null 2>&1; then
    mongo "mongodb://localhost:27017/trixtech" --quiet --eval "$cmd" 2>/dev/null
  else
    echo "null"
  fi
}

# Main alerting process
echo "========================================"
echo "TRIXTECH Performance Alerting System"
echo "========================================"
echo "Environment: $ENV"
echo "Started at: $(date)"

# Initialize alert file
echo "Performance Alert Log - $(date)" > "$ALERT_FILE"
echo "Environment: $ENV" >> "$ALERT_FILE"
echo "========================================" >> "$ALERT_FILE"

# Run checks
check_system_alerts
check_application_alerts
check_database_alerts

# Generate incident report
generate_incident_report

# Send alerts if any triggered
if (( ALERTS_TRIGGERED > 0 )); then
  log_alert "INFO" "Sending alerts - $ALERTS_TRIGGERED alerts triggered" "ALERTING"

  send_email_alert
  send_slack_alert
  push_prometheus_alerts

  echo "🚨 PERFORMANCE ALERTS TRIGGERED 🚨"
  echo "Alerts: $ALERTS_TRIGGERED"
  echo "Incident Report: $INCIDENT_REPORT"
  echo "Alert Log: $ALERT_FILE"
  exit 1
else
  log_alert "INFO" "No alerts triggered - all systems normal" "ALERTING"
  echo "✅ All performance checks passed"
  echo "Incident Report: $INCIDENT_REPORT"
  exit 0
fi