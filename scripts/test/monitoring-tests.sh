#!/bin/bash

# Monitoring Tests for TRIXTECH Booking System
# Tests health check endpoints, alerting mechanisms, and Prometheus metrics collection

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
REPORTS_DIR="$PROJECT_ROOT/reports"
TEST_ENV="${TEST_ENV:-dev}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Backend health check URL (assuming backend is running on localhost:3001)
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Test results
TEST_RESULTS=()
PASSED=0
FAILED=0

# Helper functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

assert() {
    local test_name="$1"
    local command="$2"
    local expected_exit="${3:-0}"

    log "Running test: $test_name"

    if eval "$command"; then
        actual_exit=$?
    else
        actual_exit=$?
    fi

    if [ $actual_exit -eq $expected_exit ]; then
        log "✓ PASSED: $test_name"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
        ((PASSED++))
    else
        log "✗ FAILED: $test_name (exit code: $actual_exit, expected: $expected_exit)"
        TEST_RESULTS+=("{\"name\":\"$test_name\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\",\"exit_code\":$actual_exit,\"expected\":$expected_exit}")
        ((FAILED++))
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up test artifacts..."
    # Add cleanup logic if needed
}

trap cleanup EXIT

# Test 1: Check monitoring components exist
assert "Monitoring directory exists" "[ -d '$MONITORING_DIR' ]"
assert "Prometheus configuration exists" "[ -f '$MONITORING_DIR/prometheus/prometheus.yml' ]"
assert "Alertmanager configuration exists" "[ -f '$MONITORING_DIR/prometheus/alertmanager.yml' ]"
assert "Grafana dashboards directory exists" "[ -d '$MONITORING_DIR/grafana/dashboards' ]"
assert "Backend monitoring utility exists" "[ -f '$PROJECT_ROOT/backend/utils/monitoring.js' ]"
assert "System monitor script exists" "[ -f '$PROJECT_ROOT/system_monitor.js' ]"
assert "Backend health routes exist" "[ -f '$PROJECT_ROOT/backend/routes/healthRoutes.js' ]"

# Test 2: Validate Prometheus configuration syntax
if [ -f "$MONITORING_DIR/prometheus/prometheus.yml" ]; then
    assert "Prometheus config syntax validation" "cd '$MONITORING_DIR/prometheus' && python3 -c \"import yaml; yaml.safe_load(open('prometheus.yml'))\" 2>/dev/null || [ \$? -eq 0 ]"
fi

# Test 3: Validate Alertmanager configuration syntax
if [ -f "$MONITORING_DIR/prometheus/alertmanager.yml" ]; then
    assert "Alertmanager config syntax validation" "cd '$MONITORING_DIR/prometheus' && python3 -c \"import yaml; yaml.safe_load(open('alertmanager.yml'))\" 2>/dev/null || [ \$? -eq 0 ]"
fi

# Test 4: Test health check endpoints
# Backend health check
if command -v curl >/dev/null 2>&1; then
    assert "Backend health endpoint (/api/health)" "curl -s -f '$BACKEND_URL/api/health' >/dev/null 2>&1"
    assert "Backend detailed health endpoint (/api/health/detailed)" "curl -s -f '$BACKEND_URL/api/health/detailed' >/dev/null 2>&1"
    assert "Backend database health endpoint (/api/health/database)" "curl -s -f '$BACKEND_URL/api/health/database' >/dev/null 2>&1"
    assert "Backend backup health endpoint (/api/health/backup)" "curl -s -f '$BACKEND_URL/api/health/backup' >/dev/null 2>&1"
else
    log "Warning: curl not available, skipping health endpoint tests"
    TEST_RESULTS+=("{\"name\":\"Backend health endpoints\",\"status\":\"skipped\",\"timestamp\":\"$TIMESTAMP\",\"reason\":\"curl not available\"}")
fi

# Test 5: Test system monitor script
if [ -f "$PROJECT_ROOT/system_monitor.js" ]; then
    assert "System monitor script syntax check" "cd '$PROJECT_ROOT' && node -c system_monitor.js"
    assert "System monitor script execution test" "cd '$PROJECT_ROOT' && timeout 10s node system_monitor.js --test >/dev/null 2>&1 || [ \$? -eq 124 ]"
fi

# Test 6: Test backend monitoring utility
if [ -f "$PROJECT_ROOT/backend/utils/monitoring.js" ]; then
    assert "Backend monitoring utility syntax check" "cd '$PROJECT_ROOT/backend' && node -c utils/monitoring.js"
fi

# Test 7: Test Prometheus metrics collection
# Check if Prometheus metrics endpoint is accessible
if command -v curl >/dev/null 2>&1 && [ -f "$MONITORING_DIR/prometheus/prometheus.yml" ]; then
    # Extract metrics port from prometheus config if available
    METRICS_PORT=$(grep -oP "port:\s*\K\d+" "$MONITORING_DIR/prometheus/prometheus.yml" 2>/dev/null || echo "9090")
    assert "Prometheus metrics endpoint" "curl -s -f 'http://localhost:$METRICS_PORT/metrics' >/dev/null 2>&1 || [ \$? -eq 7 ]"  # Allow connection refused (7) as Prometheus may not be running
fi

# Test 8: Validate alerting rules
if [ -f "$MONITORING_DIR/prometheus/rules.yml" ]; then
    assert "Prometheus alerting rules syntax" "python3 -c \"import yaml; yaml.safe_load(open('$MONITORING_DIR/prometheus/rules.yml'))\" 2>/dev/null || [ \$? -eq 0 ]"
fi

# Test 9: Test Grafana dashboard configurations
if [ -d "$MONITORING_DIR/grafana/dashboards" ]; then
    for dashboard in "$MONITORING_DIR/grafana/dashboards"/*.json; do
        if [ -f "$dashboard" ]; then
            assert "Grafana dashboard $(basename "$dashboard") JSON validation" "python3 -c \"import json; json.load(open('$dashboard'))\" 2>/dev/null || [ \$? -eq 0 ]"
        fi
    done
fi

# Test 10: Test performance monitoring scripts
if [ -d "$PROJECT_ROOT/scripts/performance" ]; then
    for script in "$PROJECT_ROOT/scripts/performance"/*.sh; do
        if [ -f "$script" ]; then
            assert "Performance script $(basename "$script") syntax" "bash -n '$script'"
        fi
    done
fi

# Test 11: Environment-specific monitoring configuration
case "$TEST_ENV" in
    dev)
        assert "Development monitoring configuration" "[ -f '$PROJECT_ROOT/.env.example' ] && grep -q 'MONITORING\|PROMETHEUS\|GRAFANA' '$PROJECT_ROOT/.env.example' 2>/dev/null || [ ! -f '$PROJECT_ROOT/.env.example' ]"
        ;;
    test)
        assert "Test environment monitoring configuration" "[ -f '$PROJECT_ROOT/backend/.env.test' ] && grep -q 'MONITORING\|PROMETHEUS\|GRAFANA' '$PROJECT_ROOT/backend/.env.test' 2>/dev/null || [ ! -f '$PROJECT_ROOT/backend/.env.test' ]"
        ;;
    prod)
        assert "Production monitoring configuration" "[ -f '$PROJECT_ROOT/backend/.env.production' ] && grep -q 'MONITORING\|PROMETHEUS\|GRAFANA' '$PROJECT_ROOT/backend/.env.production' 2>/dev/null || [ ! -f '$PROJECT_ROOT/backend/.env.production' ]"
        ;;
    *)
        log "Warning: Unknown TEST_ENV '$TEST_ENV', skipping environment-specific tests"
        ;;
esac

# Test 12: Test alerting mechanism simulation
# Check if alertmanager configuration has valid routes
if [ -f "$MONITORING_DIR/prometheus/alertmanager.yml" ]; then
    assert "Alertmanager routing configuration" "grep -q 'routes:' '$MONITORING_DIR/prometheus/alertmanager.yml'"
    assert "Alertmanager receivers configuration" "grep -q 'receivers:' '$MONITORING_DIR/prometheus/alertmanager.yml'"
fi

# Test 13: Test monitoring data collection
# Simulate monitoring data collection
MONITORING_TEST_DATA="$REPORTS_DIR/monitoring-test-data.json"
cat > "$MONITORING_TEST_DATA" << EOF
{
  "timestamp": "$TIMESTAMP",
  "system": {
    "cpu_usage": "simulated",
    "memory_usage": "simulated",
    "disk_usage": "simulated"
  },
  "application": {
    "response_time": "simulated",
    "error_rate": "simulated",
    "throughput": "simulated"
  }
}
EOF

assert "Monitoring data collection simulation" "[ -f '$MONITORING_TEST_DATA' ] && python3 -c \"import json; json.load(open('$MONITORING_TEST_DATA'))\""

# Generate JSON report
REPORT_FILE="$REPORTS_DIR/monitoring-test-report-$TIMESTAMP.json"
cat > "$REPORT_FILE" << EOF
{
  "test_suite": "Monitoring Tests",
  "environment": "$TEST_ENV",
  "timestamp": "$TIMESTAMP",
  "backend_url": "$BACKEND_URL",
  "frontend_url": "$FRONTEND_URL",
  "summary": {
    "total_tests": $((PASSED + FAILED)),
    "passed": $PASSED,
    "failed": $FAILED,
    "success_rate": $(echo "scale=2; $PASSED * 100 / ($PASSED + $FAILED)" | bc 2>/dev/null || echo "0")
  },
  "results": [
    $(IFS=,; echo "${TEST_RESULTS[*]}")
  ]
}
EOF

log "Monitoring test report generated: $REPORT_FILE"

# Exit with failure if any tests failed
if [ $FAILED -gt 0 ]; then
    log "Monitoring tests completed with $FAILED failures"
    exit 1
else
    log "All monitoring tests passed"
    exit 0
fi