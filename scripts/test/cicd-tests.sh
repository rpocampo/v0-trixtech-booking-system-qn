#!/bin/bash

# CI/CD Pipeline Tests for TRIXTECH Booking System
# Tests GitHub Actions workflows, build/deployment processes, and rollback mechanisms

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"
REPORTS_DIR="$PROJECT_ROOT/reports"
TEST_ENV="${TEST_ENV:-dev}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

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

# Test 1: Check GitHub Actions workflows exist
assert "Workflow files exist" "[ -d '$WORKFLOWS_DIR' ] && [ -f '$WORKFLOWS_DIR/ci.yml' ] && [ -f '$WORKFLOWS_DIR/deploy-prod.yml' ] && [ -f '$WORKFLOWS_DIR/deploy-staging.yml' ] && [ -f '$WORKFLOWS_DIR/rollback.yml' ] && [ -f '$WORKFLOWS_DIR/security-scan.yml' ]"

# Test 2: Validate YAML syntax of workflows
validate_yaml() {
    local file="$1"
    if command -v yamllint >/dev/null 2>&1; then
        yamllint "$file" >/dev/null 2>&1
    elif command -v python3 >/dev/null 2>&1 && python3 -c "import yaml" >/dev/null 2>&1; then
        python3 -c "import yaml; yaml.safe_load(open('$file'))" >/dev/null 2>&1
    else
        # Basic check - file is readable
        [ -r "$file" ]
    fi
}

for workflow in ci.yml deploy-prod.yml deploy-staging.yml rollback.yml security-scan.yml; do
    assert "YAML validation for $workflow" "validate_yaml '$WORKFLOWS_DIR/$workflow'"
done

# Test 3: Validate build processes
if [ -f "$PROJECT_ROOT/package.json" ]; then
    assert "Frontend build process" "cd '$PROJECT_ROOT' && npm run build --if-present"
fi

if [ -f "$PROJECT_ROOT/backend/package.json" ]; then
    assert "Backend build process" "cd '$PROJECT_ROOT/backend' && npm run build --if-present"
fi

# Test 4: Test deployment configurations
assert "Docker Compose production config exists" "[ -f '$PROJECT_ROOT/docker-compose.prod.yml' ]"

if [ -f "$PROJECT_ROOT/docker-compose.prod.yml" ]; then
    assert "Docker Compose config validation" "cd '$PROJECT_ROOT' && docker-compose -f docker-compose.prod.yml config >/dev/null 2>&1"
fi

# Test 5: Test rollback mechanisms
assert "Rollback workflow exists and is valid" "[ -f '$WORKFLOWS_DIR/rollback.yml' ] && validate_yaml '$WORKFLOWS_DIR/rollback.yml'"

# Test 6: Environment-specific tests
case "$TEST_ENV" in
    dev)
        assert "Development environment setup" "[ -f '$PROJECT_ROOT/.env.example' ]"
        ;;
    test)
        assert "Test environment setup" "[ -f '$PROJECT_ROOT/backend/.env.test' ]"
        ;;
    prod)
        assert "Production environment setup" "[ -f '$PROJECT_ROOT/backend/.env.production' ] && [ -f '$PROJECT_ROOT/frontend/.env.production' ]"
        ;;
    *)
        log "Warning: Unknown TEST_ENV '$TEST_ENV', skipping environment-specific tests"
        ;;
esac

# Generate JSON report
REPORT_FILE="$REPORTS_DIR/cicd-test-report-$TIMESTAMP.json"
cat > "$REPORT_FILE" << EOF
{
  "test_suite": "CI/CD Pipeline Tests",
  "environment": "$TEST_ENV",
  "timestamp": "$TIMESTAMP",
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

log "CI/CD test report generated: $REPORT_FILE"

# Exit with failure if any tests failed
if [ $FAILED -gt 0 ]; then
    log "CI/CD tests completed with $FAILED failures"
    exit 1
else
    log "All CI/CD tests passed"
    exit 0
fi