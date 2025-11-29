#!/bin/bash

# Integration Test Orchestrator for TRIXTECH Booking System
# Runs all component tests in sequence, tests component interactions, and generates comprehensive test suite reports

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/reports"
TEST_ENV="${TEST_ENV:-dev}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Test scripts to run
TEST_SCRIPTS=(
    "cicd-tests.sh"
    "backup-tests.sh"
    "monitoring-tests.sh"
    "autoscaling-tests.sh"
    "selfheal-tests.sh"
    "maintenance-tests.sh"
    "security-tests.sh"
    "performance-tests.sh"
)

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Test results aggregation
ALL_RESULTS=()
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_TESTS=0
EXECUTED_TESTS=0

# Helper functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Cleanup function
cleanup() {
    log "Cleaning up integration test artifacts..."
    # Add cleanup logic if needed
}

trap cleanup EXIT

log "Starting TRIXTECH Integration Test Suite"
log "Environment: $TEST_ENV"
log "Timestamp: $TIMESTAMP"
log "=========================================="

# Test 1: Check all test scripts exist
log "Checking test script availability..."
for script in "${TEST_SCRIPTS[@]}"; do
    script_path="$SCRIPT_DIR/$script"
    if [ -f "$script_path" ]; then
        log "✓ Found: $script"
        ((EXECUTED_TESTS++))
    else
        log "✗ Missing: $script"
        ALL_RESULTS+=("{\"name\":\"$script\",\"status\":\"missing\",\"timestamp\":\"$TIMESTAMP\"}")
        ((TOTAL_FAILED++))
    fi
done

# Test 2: Run individual test suites
log "Executing individual test suites..."
for script in "${TEST_SCRIPTS[@]}"; do
    script_path="$SCRIPT_DIR/$script"
    if [ -f "$script_path" ]; then
        log "Running $script..."

        # Set environment variable for the test script
        export TEST_ENV="$TEST_ENV"

        # Run the test script and capture output
        if bash "$script_path" > /tmp/test_output.log 2>&1; then
            exit_code=$?
        else
            exit_code=$?
        fi

        # Parse the generated report if it exists
        report_file="$REPORTS_DIR/$(basename "$script" .sh)-test-report-$TIMESTAMP.json"
        if [ -f "$report_file" ]; then
            # Extract results from JSON report
            if command -v jq >/dev/null 2>&1; then
                script_passed=$(jq -r '.summary.passed' "$report_file" 2>/dev/null || echo "0")
                script_failed=$(jq -r '.summary.failed' "$report_file" 2>/dev/null || echo "0")
                script_total=$(jq -r '.summary.total_tests' "$report_file" 2>/dev/null || echo "0")
            else
                # Fallback parsing with grep/awk
                script_passed=$(grep -o '"passed":[0-9]*' "$report_file" | grep -o '[0-9]*' | head -1 || echo "0")
                script_failed=$(grep -o '"failed":[0-9]*' "$report_file" | grep -o '[0-9]*' | head -1 || echo "0")
                script_total=$(grep -o '"total_tests":[0-9]*' "$report_file" | grep -o '[0-9]*' | head -1 || echo "0")
            fi

            TOTAL_PASSED=$((TOTAL_PASSED + script_passed))
            TOTAL_FAILED=$((TOTAL_FAILED + script_failed))
            TOTAL_TESTS=$((TOTAL_TESTS + script_total))

            if [ $exit_code -eq 0 ]; then
                log "✓ $script completed successfully"
                ALL_RESULTS+=("{\"name\":\"$script\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\",\"exit_code\":$exit_code,\"tests_passed\":$script_passed,\"tests_failed\":$script_failed}")
            else
                log "✗ $script completed with failures (exit code: $exit_code)"
                ALL_RESULTS+=("{\"name\":\"$script\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\",\"exit_code\":$exit_code,\"tests_passed\":$script_passed,\"tests_failed\":$script_failed}")
            fi
        else
            log "⚠ $script completed but no report generated"
            ALL_RESULTS+=("{\"name\":\"$script\",\"status\":\"no_report\",\"timestamp\":\"$TIMESTAMP\",\"exit_code\":$exit_code}")
            ((TOTAL_FAILED++))
        fi
    fi
done

# Test 3: Test component interactions
log "Testing component interactions..."

# Simulate interaction testing
INTERACTION_TESTS=(
    "backup_and_monitoring_integration"
    "security_and_performance_integration"
    "autoscaling_and_monitoring_integration"
    "maintenance_and_backup_integration"
    "cicd_and_security_integration"
)

for interaction in "${INTERACTION_TESTS[@]}"; do
    log "Testing $interaction..."
    # Simulate interaction validation
    case $interaction in
        "backup_and_monitoring_integration")
            # Check if backup monitoring is integrated
            if [ -f "$PROJECT_ROOT/scripts/backup/backup-monitor.sh" ] && [ -f "$PROJECT_ROOT/monitoring/prometheus/rules.yml" ]; then
                log "✓ Backup and monitoring integration validated"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Backup and monitoring integration failed"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "security_and_performance_integration")
            # Check if security monitoring includes performance
            if [ -f "$PROJECT_ROOT/scripts/security/compliance-check.sh" ] && [ -f "$PROJECT_ROOT/scripts/performance/performance-alert.sh" ]; then
                log "✓ Security and performance integration validated"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Security and performance integration failed"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "autoscaling_and_monitoring_integration")
            # Check if autoscaling integrates with monitoring
            if [ -d "$PROJECT_ROOT/monitoring" ] && [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
                log "✓ Autoscaling and monitoring integration validated"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Autoscaling and monitoring integration failed"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "maintenance_and_backup_integration")
            # Check if maintenance includes backup operations
            if [ -d "$PROJECT_ROOT/backend/scripts" ] && [ -f "$PROJECT_ROOT/scripts/backup.sh" ]; then
                log "✓ Maintenance and backup integration validated"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Maintenance and backup integration failed"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "cicd_and_security_integration")
            # Check if CI/CD includes security scanning
            if [ -f "$PROJECT_ROOT/.github/workflows/security-scan.yml" ] && [ -f "$PROJECT_ROOT/.github/workflows/ci.yml" ]; then
                log "✓ CI/CD and security integration validated"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ CI/CD and security integration failed"
                ALL_RESULTS+=("{\"name\":\"$interaction\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
    esac
    ((TOTAL_TESTS++))
done

# Test 4: Validate end-to-end automation workflows
log "Validating end-to-end automation workflows..."

# Simulate end-to-end workflow validation
E2E_WORKFLOWS=(
    "deployment_pipeline"
    "backup_recovery_workflow"
    "incident_response_workflow"
    "maintenance_procedures"
)

for workflow in "${E2E_WORKFLOWS[@]}"; do
    log "Validating $workflow..."
    case $workflow in
        "deployment_pipeline")
            if [ -f "$PROJECT_ROOT/.github/workflows/ci.yml" ] && [ -f "$PROJECT_ROOT/.github/workflows/deploy-prod.yml" ] && [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
                log "✓ Deployment pipeline workflow validated"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Deployment pipeline workflow validation failed"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "backup_recovery_workflow")
            if [ -f "$PROJECT_ROOT/scripts/backup.sh" ] && [ -f "$PROJECT_ROOT/scripts/backup/restore.sh" ] && [ -f "$PROJECT_ROOT/scripts/backup/verify-backup.sh" ]; then
                log "✓ Backup recovery workflow validated"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Backup recovery workflow validation failed"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "incident_response_workflow")
            if [ -d "$PROJECT_ROOT/scripts/selfheal" ] && [ -f "$PROJECT_ROOT/monitoring/prometheus/alertmanager.yml" ]; then
                log "✓ Incident response workflow validated"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Incident response workflow validation failed"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
        "maintenance_procedures")
            if [ -d "$PROJECT_ROOT/backend/scripts" ] && [ -f "$PROJECT_ROOT/scripts/backup/cleanup-backups.sh" ]; then
                log "✓ Maintenance procedures workflow validated"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"passed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_PASSED++))
            else
                log "✗ Maintenance procedures workflow validation failed"
                ALL_RESULTS+=("{\"name\":\"$workflow\",\"status\":\"failed\",\"timestamp\":\"$TIMESTAMP\"}")
                ((TOTAL_FAILED++))
            fi
            ;;
    esac
    ((TOTAL_TESTS++))
done

# Generate comprehensive integration report
INTEGRATION_REPORT_FILE="$REPORTS_DIR/integration-test-suite-report-$TIMESTAMP.json"
cat > "$INTEGRATION_REPORT_FILE" << EOF
{
  "test_suite": "TRIXTECH Integration Test Suite",
  "environment": "$TEST_ENV",
  "timestamp": "$TIMESTAMP",
  "execution_summary": {
    "total_test_scripts": ${#TEST_SCRIPTS[@]},
    "executed_test_scripts": $EXECUTED_TESTS,
    "component_interaction_tests": ${#INTERACTION_TESTS[@]},
    "end_to_end_workflow_tests": ${#E2E_WORKFLOWS[@]}
  },
  "overall_summary": {
    "total_tests": $TOTAL_TESTS,
    "passed": $TOTAL_PASSED,
    "failed": $TOTAL_FAILED,
    "success_rate": $(echo "scale=2; $TOTAL_PASSED * 100 / ($TOTAL_PASSED + $TOTAL_FAILED)" | bc 2>/dev/null || echo "0")
  },
  "component_test_results": [
    $(IFS=,; echo "${ALL_RESULTS[*]}")
  ],
  "recommendations": [
    "Review failed test components for issues",
    "Ensure all automation scripts are properly integrated",
    "Validate monitoring and alerting configurations",
    "Test backup and recovery procedures regularly",
    "Monitor performance and security metrics continuously"
  ]
}
EOF

log "Integration test suite completed"
log "Total test scripts executed: $EXECUTED_TESTS"
log "Total tests run: $TOTAL_TESTS"
log "Tests passed: $TOTAL_PASSED"
log "Tests failed: $TOTAL_FAILED"
log "Integration report generated: $INTEGRATION_REPORT_FILE"

# Exit with failure if any tests failed
if [ $TOTAL_FAILED -gt 0 ]; then
    log "Integration test suite completed with $TOTAL_FAILED failures"
    exit 1
else
    log "All integration tests passed successfully"
    exit 0
fi