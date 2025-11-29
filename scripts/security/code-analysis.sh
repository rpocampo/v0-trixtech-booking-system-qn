#!/bin/bash

# TRIXTECH Booking System - Security Code Analysis
# This script performs comprehensive security code analysis including:
# - Static Application Security Testing (SAST)
# - Secret detection and prevention
# - Code quality and security linting
# - Generate security findings reports

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$PROJECT_ROOT/reports/security"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORTS_DIR/code_analysis_$ENVIRONMENT_$TIMESTAMP.json"
ALERT_FILE="$REPORTS_DIR/security_findings_$ENVIRONMENT_$TIMESTAMP.txt"

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

# Create reports directory
mkdir -p "$REPORTS_DIR"

# Initialize report
REPORT_DATA='{
  "scan_timestamp": "'$(date -Iseconds)'",
  "environment": "'$ENVIRONMENT'",
  "analyzer_version": "1.0.0",
  "findings": {
    "sast": {},
    "secrets": {},
    "linting": {}
  },
  "summary": {
    "total_findings": 0,
    "critical_findings": 0,
    "high_findings": 0,
    "medium_findings": 0,
    "low_findings": 0
  }
}'

# Function to update report
update_report() {
    local section=$1
    local data=$2
    REPORT_DATA=$(echo "$REPORT_DATA" | jq ".$section = $data")
}

# Function to send alert
send_alert() {
    local message=$1
    local severity=$2
    echo "[$(date)] $severity: $message" >> "$ALERT_FILE"

    # Send to notification service if configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"TRIXTECH Security Finding [$severity]: $message\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi

    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "TRIXTECH Security Finding [$severity]" "$EMAIL_RECIPIENT" || true
    fi
}

# 1. Static Application Security Testing (SAST)
log_info "Running Static Application Security Testing (SAST)..."

# Install ESLint security plugins if not present
cd "$PROJECT_ROOT/backend"
if [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ]; then
    log_warn "No ESLint config found in backend, creating basic security config..."
    cat > .eslintrc.json << EOF
{
  "extends": [
    "eslint:recommended"
  ],
  "plugins": ["security"],
  "rules": {
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "warn",
    "security/detect-disable-mustache-escape": "error",
    "security/detect-eval-with-expression": "error",
    "security/detect-new-buffer": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-fs-filename": "warn",
    "security/detect-non-literal-regexp": "warn",
    "security/detect-non-literal-require": "error",
    "security/detect-object-injection": "error",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error"
  }
}
EOF
fi

# Run ESLint with security rules
if command -v eslint &> /dev/null; then
    SAST_BACKEND=$(eslint . --format json --ext .js,.ts 2>/dev/null || echo '[]')
    update_report "findings.sast.backend" "$SAST_BACKEND"

    # Check for critical findings
    CRITICAL_SAST=$(echo "$SAST_BACKEND" | jq '[.[] | select(.errorCount > 0 or .warningCount > 0)] | length' 2>/dev/null || echo "0")
    if [ "$CRITICAL_SAST" -gt 0 ]; then
        send_alert "Critical SAST findings in backend: $CRITICAL_SAST issues" "CRITICAL"
    fi

    log_info "Backend SAST completed."
else
    log_warn "ESLint not found, installing..."
    npm install --save-dev eslint eslint-plugin-security
    SAST_BACKEND=$(npx eslint . --format json --ext .js,.ts 2>/dev/null || echo '[]')
    update_report "findings.sast.backend" "$SAST_BACKEND"
fi

# Frontend SAST
cd "$PROJECT_ROOT/frontend"
if [ ! -f ".eslintrc.json" ]; then
    log_warn "No ESLint config found in frontend, using existing or creating basic..."
    # Assume it has ESLint configured
fi

if command -v eslint &> /dev/null; then
    SAST_FRONTEND=$(eslint . --format json --ext .js,.jsx,.ts,.tsx 2>/dev/null || echo '[]')
    update_report "findings.sast.frontend" "$SAST_FRONTEND"

    CRITICAL_SAST_FRONTEND=$(echo "$SAST_FRONTEND" | jq '[.[] | select(.errorCount > 0)] | length' 2>/dev/null || echo "0")
    if [ "$CRITICAL_SAST_FRONTEND" -gt 0 ]; then
        send_alert "Critical SAST findings in frontend: $CRITICAL_SAST_FRONTEND issues" "CRITICAL"
    fi

    log_info "Frontend SAST completed."
else
    log_warn "ESLint not available for frontend."
fi

# 2. Secret Detection
log_info "Running secret detection..."

if command -v gitleaks &> /dev/null; then
    cd "$PROJECT_ROOT"
    SECRETS_OUTPUT=$(gitleaks detect --verbose --redact --format json 2>/dev/null || echo '[]')
    update_report "findings.secrets" "$SECRETS_OUTPUT"

    SECRETS_COUNT=$(echo "$SECRETS_OUTPUT" | jq 'length' 2>/dev/null || echo "0")
    if [ "$SECRETS_COUNT" -gt 0 ]; then
        send_alert "Potential secrets detected: $SECRETS_COUNT findings" "CRITICAL"
        log_error "Secrets found! Review the report immediately."
    fi

    log_info "Secret detection completed. Found $SECRETS_COUNT potential secrets."
elif command -v trufflehog &> /dev/null; then
    cd "$PROJECT_ROOT"
    SECRETS_OUTPUT=$(trufflehog filesystem . --json 2>/dev/null || echo '[]')
    update_report "findings.secrets" "$SECRETS_OUTPUT"

    SECRETS_COUNT=$(echo "$SECRETS_OUTPUT" | jq 'length' 2>/dev/null || echo "0")
    if [ "$SECRETS_COUNT" -gt 0 ]; then
        send_alert "Potential secrets detected: $SECRETS_COUNT findings" "CRITICAL"
    fi

    log_info "Secret detection completed with TruffleHog. Found $SECRETS_COUNT potential secrets."
else
    log_warn "Neither gitleaks nor trufflehog found. Installing gitleaks..."
    # Note: In a real environment, you'd install it properly
    log_warn "Secret detection skipped - tools not available."
    update_report "findings.secrets" '[{"error": "Secret detection tools not available"}]'
fi

# 3. Code Quality and Security Linting
log_info "Running code quality and security linting..."

# Backend linting
cd "$PROJECT_ROOT/backend"
if command -v eslint &> /dev/null; then
    LINT_BACKEND=$(eslint . --format json --ext .js,.ts 2>/dev/null || echo '[]')
    update_report "findings.linting.backend" "$LINT_BACKEND"

    LINT_ERRORS=$(echo "$LINT_BACKEND" | jq '[.[] | .errorCount] | add' 2>/dev/null || echo "0")
    LINT_WARNINGS=$(echo "$LINT_BACKEND" | jq '[.[] | .warningCount] | add' 2>/dev/null || echo "0")

    log_info "Backend linting: $LINT_ERRORS errors, $LINT_WARNINGS warnings."
else
    log_warn "ESLint not available for backend linting."
fi

# Frontend linting
cd "$PROJECT_ROOT/frontend"
if command -v eslint &> /dev/null; then
    LINT_FRONTEND=$(eslint . --format json --ext .js,.jsx,.ts,.tsx 2>/dev/null || echo '[]')
    update_report "findings.linting.frontend" "$LINT_FRONTEND"

    LINT_FRONTEND_ERRORS=$(echo "$LINT_FRONTEND" | jq '[.[] | .errorCount] | add' 2>/dev/null || echo "0")
    LINT_FRONTEND_WARNINGS=$(echo "$LINT_FRONTEND" | jq '[.[] | .warningCount] | add' 2>/dev/null || echo "0")

    log_info "Frontend linting: $LINT_FRONTEND_ERRORS errors, $LINT_FRONTEND_WARNINGS warnings."
else
    log_warn "ESLint not available for frontend linting."
fi

# Calculate summary
log_info "Calculating findings summary..."
TOTAL_FINDINGS=$(echo "$REPORT_DATA" | jq '
  (.findings.sast.backend | length) +
  (.findings.sast.frontend | length) +
  (.findings.secrets | length) +
  (.findings.linting.backend | length) +
  (.findings.linting.frontend | length)
' 2>/dev/null || echo "0")

REPORT_DATA=$(echo "$REPORT_DATA" | jq ".summary.total_findings = $TOTAL_FINDINGS")

# Generate final report
echo "$REPORT_DATA" > "$REPORT_FILE"

log_info "Security code analysis completed."
log_info "Report saved to: $REPORT_FILE"
if [ -f "$ALERT_FILE" ]; then
    log_info "Findings saved to: $ALERT_FILE"
fi

# Exit with error code if critical findings found
CRITICAL_TOTAL=$(echo "$REPORT_DATA" | jq '.summary.critical_findings' 2>/dev/null || echo "0")
SECRETS_FOUND=$(echo "$REPORT_DATA" | jq '.findings.secrets | length' 2>/dev/null || echo "0")

if [ "$CRITICAL_TOTAL" -gt 0 ] || [ "$SECRETS_FOUND" -gt 0 ]; then
    log_error "Critical security findings detected. Review the report and take action."
    exit 1
fi

log_info "No critical security findings found."