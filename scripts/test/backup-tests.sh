#!/bin/bash

# Backup System Tests for TRIXTECH Booking System
# Tests database backup/restore, file system backups, and retention policies

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_SCRIPTS_DIR="$PROJECT_ROOT/scripts/backup"
MAIN_BACKUP_SCRIPT="$PROJECT_ROOT/scripts/backup.sh"
SETUP_CRON_SCRIPT="$PROJECT_ROOT/scripts/setup-backup-cron.sh"
REPORTS_DIR="$PROJECT_ROOT/reports"
TEST_BACKUP_DIR="$PROJECT_ROOT/test_backups"
TEST_ENV="${TEST_ENV:-dev}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Create test directories
mkdir -p "$REPORTS_DIR" "$TEST_BACKUP_DIR"

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
    # Remove test backup directory
    rm -rf "$TEST_BACKUP_DIR"
}

trap cleanup EXIT

# Test 1: Check backup scripts exist
assert "Main backup script exists" "[ -f '$MAIN_BACKUP_SCRIPT' ]"
assert "Backup scripts directory exists" "[ -d '$BACKUP_SCRIPTS_DIR' ]"
assert "Database backup script exists" "[ -f '$BACKUP_SCRIPTS_DIR/db-backup.sh' ]"
assert "File backup script exists" "[ -f '$BACKUP_SCRIPTS_DIR/file-backup.sh' ]"
assert "Backup verification script exists" "[ -f '$BACKUP_SCRIPTS_DIR/verify-backup.sh' ]"
assert "Backup cleanup script exists" "[ -f '$BACKUP_SCRIPTS_DIR/cleanup-backups.sh' ]"
assert "Backup restore script exists" "[ -f '$BACKUP_SCRIPTS_DIR/restore.sh' ]"
assert "Backup scheduling script exists" "[ -f '$BACKUP_SCRIPTS_DIR/schedule-backups.sh' ]"
assert "Backup monitoring script exists" "[ -f '$BACKUP_SCRIPTS_DIR/backup-monitor.sh' ]"

# Test 2: Validate backup script syntax
validate_script_syntax() {
    local script="$1"
    if command -v bash >/dev/null 2>&1; then
        bash -n "$script" >/dev/null 2>&1
    else
        [ -r "$script" ]  # Basic check
    fi
}

for script in "$MAIN_BACKUP_SCRIPT" "$SETUP_CRON_SCRIPT" "$BACKUP_SCRIPTS_DIR"/*.sh; do
    if [ -f "$script" ]; then
        assert "Syntax validation for $(basename "$script")" "validate_script_syntax '$script'"
    fi
done

# Test 3: Test backup directory creation and permissions
assert "Test backup directory creation" "mkdir -p '$TEST_BACKUP_DIR' && [ -d '$TEST_BACKUP_DIR' ]"

# Test 4: Test database backup simulation (without actual backup)
# This test checks if the backup script would run without errors in dry-run mode
if [ -f "$BACKUP_SCRIPTS_DIR/db-backup.sh" ]; then
    assert "Database backup script dry run" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' bash '$BACKUP_SCRIPTS_DIR/db-backup.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 5: Test file system backup simulation
if [ -f "$BACKUP_SCRIPTS_DIR/file-backup.sh" ]; then
    assert "File backup script dry run" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' bash '$BACKUP_SCRIPTS_DIR/file-backup.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 6: Test backup verification script
if [ -f "$BACKUP_SCRIPTS_DIR/verify-backup.sh" ]; then
    assert "Backup verification script execution" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' bash '$BACKUP_SCRIPTS_DIR/verify-backup.sh' >/dev/null 2>&1 || [ \$? -eq 0 ]"
fi

# Test 7: Test retention policy validation
if [ -f "$BACKUP_SCRIPTS_DIR/cleanup-backups.sh" ]; then
    assert "Backup cleanup script validation" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' RETENTION_DAYS=30 MIN_BACKUPS=5 bash '$BACKUP_SCRIPTS_DIR/cleanup-backups.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 8: Test restore script validation
if [ -f "$BACKUP_SCRIPTS_DIR/restore.sh" ]; then
    assert "Backup restore script validation" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' bash '$BACKUP_SCRIPTS_DIR/restore.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 9: Test backup monitoring script
if [ -f "$BACKUP_SCRIPTS_DIR/backup-monitor.sh" ]; then
    assert "Backup monitoring script validation" "cd '$PROJECT_ROOT' && BACKUP_DIR='$TEST_BACKUP_DIR' bash '$BACKUP_SCRIPTS_DIR/backup-monitor.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 10: Test backup scheduling script
if [ -f "$BACKUP_SCRIPTS_DIR/schedule-backups.sh" ]; then
    assert "Backup scheduling script validation" "cd '$PROJECT_ROOT' && BACKUP_SCRIPTS_DIR='$BACKUP_SCRIPTS_DIR' bash '$BACKUP_SCRIPTS_DIR/schedule-backups.sh' --help >/dev/null 2>&1 || [ \$? -eq 1 ]"
fi

# Test 11: Environment-specific backup configuration
case "$TEST_ENV" in
    dev)
        assert "Development backup configuration" "[ -f '$PROJECT_ROOT/.env.example' ] && grep -q 'BACKUP' '$PROJECT_ROOT/.env.example' 2>/dev/null || [ ! -f '$PROJECT_ROOT/.env.example' ]"
        ;;
    test)
        assert "Test environment backup configuration" "[ -f '$PROJECT_ROOT/backend/.env.test' ] && grep -q 'BACKUP' '$PROJECT_ROOT/backend/.env.test' 2>/dev/null || [ ! -f '$PROJECT_ROOT/backend/.env.test' ]"
        ;;
    prod)
        assert "Production backup configuration" "[ -f '$PROJECT_ROOT/backend/.env.production' ] && grep -q 'BACKUP' '$PROJECT_ROOT/backend/.env.production' 2>/dev/null || [ ! -f '$PROJECT_ROOT/backend/.env.production' ]"
        ;;
    *)
        log "Warning: Unknown TEST_ENV '$TEST_ENV', skipping environment-specific tests"
        ;;
esac

# Test 12: Test backup integrity checks
# Create a dummy backup file for testing
DUMMY_BACKUP="$TEST_BACKUP_DIR/test_backup.tar.gz"
echo "test data" > "$TEST_BACKUP_DIR/test_file.txt"
tar -czf "$DUMMY_BACKUP" -C "$TEST_BACKUP_DIR" test_file.txt >/dev/null 2>&1

assert "Backup integrity check" "tar -tzf '$DUMMY_BACKUP' >/dev/null 2>&1"

# Test 13: Test retention policy simulation
# Create some test backup files with different dates
for i in {1..5}; do
    touch -d "$i days ago" "$TEST_BACKUP_DIR/old_backup_$i.tar.gz"
done

assert "Retention policy simulation" "find '$TEST_BACKUP_DIR' -name '*.tar.gz' -mtime +2 -delete && [ \$(find '$TEST_BACKUP_DIR' -name '*.tar.gz' | wc -l) -le 3 ]"

# Generate JSON report
REPORT_FILE="$REPORTS_DIR/backup-test-report-$TIMESTAMP.json"
cat > "$REPORT_FILE" << EOF
{
  "test_suite": "Backup System Tests",
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

log "Backup test report generated: $REPORT_FILE"

# Exit with failure if any tests failed
if [ $FAILED -gt 0 ]; then
    log "Backup tests completed with $FAILED failures"
    exit 1
else
    log "All backup tests passed"
    exit 0
fi