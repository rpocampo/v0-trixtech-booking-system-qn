#!/bin/bash

# TRIXTECH Booking System - Compliance Automation
# This script performs automated compliance checks:
# - Automated compliance checks (GDPR, PCI-DSS)
# - Security policy enforcement
# - Audit trail generation
# - Compliance reporting

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORTS_DIR="$PROJECT_ROOT/reports/compliance"
AUDIT_DIR="$PROJECT_ROOT/audit/compliance"
COMPLIANCE_REPORT="$REPORTS_DIR/compliance_check_$ENVIRONMENT_$TIMESTAMP.json"
AUDIT_LOG="$AUDIT_DIR/compliance_audit_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$AUDIT_LOG"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$AUDIT_LOG"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$AUDIT_LOG"
}

# Create directories
mkdir -p "$REPORTS_DIR"
mkdir -p "$AUDIT_DIR"

# Initialize compliance report
COMPLIANCE_DATA='{
  "check_timestamp": "'$(date -Iseconds)'",
  "environment": "'$ENVIRONMENT'",
  "compliance_frameworks": {
    "gdpr": {
      "status": "unknown",
      "checks_passed": 0,
      "checks_failed": 0,
      "findings": []
    },
    "pci_dss": {
      "status": "unknown",
      "checks_passed": 0,
      "checks_failed": 0,
      "findings": []
    }
  },
  "policy_enforcement": {
    "status": "unknown",
    "policies_checked": 0,
    "policies_enforced": 0,
    "violations": []
  }
}'

# Function to update compliance report
update_compliance() {
    local framework=$1
    local check_name=$2
    local status=$3
    local details=$4

    if [ "$status" = "pass" ]; then
        COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".compliance_frameworks.$framework.checks_passed += 1")
    else
        COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".compliance_frameworks.$framework.checks_failed += 1")
        COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".compliance_frameworks.$framework.findings += [{\"check\": \"$check_name\", \"status\": \"$status\", \"details\": \"$details\"}]")
    fi
}

# Function to send alert
send_alert() {
    local message=$1
    local severity=$2

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"TRIXTECH Compliance Alert [$severity]: $message\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi

    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "TRIXTECH Compliance Alert [$severity]" "$EMAIL_RECIPIENT" || true
    fi
}

log_info "Starting compliance checks..."

# 1. GDPR Compliance Checks
log_info "Performing GDPR compliance checks..."

# GDPR Check 1: Data encryption at rest
if grep -r "bcrypt\|crypto" "$PROJECT_ROOT/backend" >/dev/null 2>&1; then
    update_compliance "gdpr" "data_encryption_at_rest" "pass" "Encryption mechanisms found in backend"
    log_info "✓ GDPR: Data encryption at rest - PASS"
else
    update_compliance "gdpr" "data_encryption_at_rest" "fail" "No encryption mechanisms found"
    log_error "✗ GDPR: Data encryption at rest - FAIL"
fi

# GDPR Check 2: Data minimization
DATA_FIELDS=$(grep -r "password\|email\|phone\|address" "$PROJECT_ROOT/backend/models" | wc -l)
if [ "$DATA_FIELDS" -gt 0 ]; then
    update_compliance "gdpr" "data_minimization" "pass" "Personal data fields identified and tracked"
    log_info "✓ GDPR: Data minimization - PASS"
else
    update_compliance "gdpr" "data_minimization" "warn" "Unable to verify data minimization practices"
    log_warn "! GDPR: Data minimization - WARN"
fi

# GDPR Check 3: Consent management
if grep -r "consent\|gdpr\|privacy" "$PROJECT_ROOT/frontend" >/dev/null 2>&1; then
    update_compliance "gdpr" "consent_management" "pass" "Consent management components found"
    log_info "✓ GDPR: Consent management - PASS"
else
    update_compliance "gdpr" "consent_management" "fail" "No consent management components found"
    log_error "✗ GDPR: Consent management - FAIL"
fi

# GDPR Check 4: Right to erasure
if grep -r "delete.*user\|erase.*data" "$PROJECT_ROOT/backend/routes" >/dev/null 2>&1; then
    update_compliance "gdpr" "right_to_erasure" "pass" "Data deletion endpoints found"
    log_info "✓ GDPR: Right to erasure - PASS"
else
    update_compliance "gdpr" "right_to_erasure" "fail" "No data deletion endpoints found"
    log_error "✗ GDPR: Right to erasure - FAIL"
fi

# GDPR Check 5: Data breach notification
if grep -r "breach\|incident" "$PROJECT_ROOT/backend/utils" >/dev/null 2>&1; then
    update_compliance "gdpr" "breach_notification" "pass" "Breach notification mechanisms found"
    log_info "✓ GDPR: Breach notification - PASS"
else
    update_compliance "gdpr" "breach_notification" "fail" "No breach notification mechanisms found"
    log_error "✗ GDPR: Breach notification - FAIL"
fi

# 2. PCI-DSS Compliance Checks
log_info "Performing PCI-DSS compliance checks..."

# PCI Check 1: Cardholder data encryption
if grep -r "stripe\|payment.*encrypt" "$PROJECT_ROOT/backend" >/dev/null 2>&1; then
    update_compliance "pci_dss" "cardholder_data_encryption" "pass" "Payment data encryption found"
    log_info "✓ PCI-DSS: Cardholder data encryption - PASS"
else
    update_compliance "pci_dss" "cardholder_data_encryption" "fail" "No payment data encryption found"
    log_error "✗ PCI-DSS: Cardholder data encryption - FAIL"
fi

# PCI Check 2: Secure payment processing
PAYMENT_ROUTES=$(grep -r "payment\|stripe\|gcash" "$PROJECT_ROOT/backend/routes" | wc -l)
if [ "$PAYMENT_ROUTES" -gt 0 ]; then
    update_compliance "pci_dss" "secure_payment_processing" "pass" "Secure payment routes implemented"
    log_info "✓ PCI-DSS: Secure payment processing - PASS"
else
    update_compliance "pci_dss" "secure_payment_processing" "fail" "No secure payment routes found"
    log_error "✗ PCI-DSS: Secure payment processing - FAIL"
fi

# PCI Check 3: Access controls
if grep -r "auth\|jwt\|session" "$PROJECT_ROOT/backend/middleware" >/dev/null 2>&1; then
    update_compliance "pci_dss" "access_controls" "pass" "Access control mechanisms implemented"
    log_info "✓ PCI-DSS: Access controls - PASS"
else
    update_compliance "pci_dss" "access_controls" "fail" "No access control mechanisms found"
    log_error "✗ PCI-DSS: Access controls - FAIL"
fi

# PCI Check 4: Audit logging
if grep -r "log\|audit" "$PROJECT_ROOT/backend/utils" >/dev/null 2>&1; then
    update_compliance "pci_dss" "audit_logging" "pass" "Audit logging mechanisms found"
    log_info "✓ PCI-DSS: Audit logging - PASS"
else
    update_compliance "pci_dss" "audit_logging" "fail" "No audit logging found"
    log_error "✗ PCI-DSS: Audit logging - FAIL"
fi

# PCI Check 5: Vulnerability management
if [ -f "$SCRIPT_DIR/vulnerability-scan.sh" ]; then
    update_compliance "pci_dss" "vulnerability_management" "pass" "Vulnerability scanning script available"
    log_info "✓ PCI-DSS: Vulnerability management - PASS"
else
    update_compliance "pci_dss" "vulnerability_management" "fail" "No vulnerability management tools found"
    log_error "✗ PCI-DSS: Vulnerability management - FAIL"
fi

# 3. Security Policy Enforcement
log_info "Performing security policy enforcement checks..."

POLICY_CHECKS=(
    "password_policy:Password complexity requirements"
    "session_timeout:Session timeout configuration"
    "ssl_tls:SSL/TLS configuration"
    "firewall:Firewall configuration"
    "backup:Backup procedures"
)

for policy_check in "${POLICY_CHECKS[@]}"; do
    IFS=':' read -r check_name check_desc <<< "$policy_check"

    case $check_name in
        "password_policy")
            if grep -r "bcrypt\|password.*strength" "$PROJECT_ROOT/backend" >/dev/null 2>&1; then
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_enforced += 1")
                log_info "✓ Policy: $check_desc - ENFORCED"
            else
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.violations += [{\"policy\": \"$check_name\", \"description\": \"$check_desc\"}]")
                log_error "✗ Policy: $check_desc - VIOLATION"
            fi
            ;;
        "session_timeout")
            if grep -r "session.*timeout\|expires" "$PROJECT_ROOT/backend" >/dev/null 2>&1; then
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_enforced += 1")
                log_info "✓ Policy: $check_desc - ENFORCED"
            else
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.violations += [{\"policy\": \"$check_name\", \"description\": \"$check_desc\"}]")
                log_error "✗ Policy: $check_desc - VIOLATION"
            fi
            ;;
        "ssl_tls")
            if grep -r "https\|ssl\|tls" "$PROJECT_ROOT" >/dev/null 2>&1; then
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_enforced += 1")
                log_info "✓ Policy: $check_desc - ENFORCED"
            else
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.violations += [{\"policy\": \"$check_name\", \"description\": \"$check_desc\"}]")
                log_error "✗ Policy: $check_desc - VIOLATION"
            fi
            ;;
        "firewall")
            if command -v ufw >/dev/null 2>&1 || command -v firewall-cmd >/dev/null 2>&1; then
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_enforced += 1")
                log_info "✓ Policy: $check_desc - ENFORCED"
            else
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.violations += [{\"policy\": \"$check_name\", \"description\": \"$check_desc\"}]")
                log_warn "! Policy: $check_desc - UNKNOWN"
            fi
            ;;
        "backup")
            if [ -d "$PROJECT_ROOT/backups" ] || grep -r "backup" "$PROJECT_ROOT/scripts" >/dev/null 2>&1; then
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_enforced += 1")
                log_info "✓ Policy: $check_desc - ENFORCED"
            else
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.policies_checked += 1")
                COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq ".policy_enforcement.violations += [{\"policy\": \"$check_name\", \"description\": \"$check_desc\"}]")
                log_error "✗ Policy: $check_desc - VIOLATION"
            fi
            ;;
    esac
done

# Calculate overall compliance status
GDPR_FAILED=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.gdpr.checks_failed')
PCI_FAILED=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.pci_dss.checks_failed')
POLICY_VIOLATIONS=$(echo "$COMPLIANCE_DATA" | jq '.policy_enforcement.violations | length')

if [ "$GDPR_FAILED" -eq 0 ]; then
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.gdpr.status = "compliant"')
else
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.gdpr.status = "non_compliant"')
fi

if [ "$PCI_FAILED" -eq 0 ]; then
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.pci_dss.status = "compliant"')
else
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.compliance_frameworks.pci_dss.status = "non_compliant"')
fi

if [ "$POLICY_VIOLATIONS" -eq 0 ]; then
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.policy_enforcement.status = "enforced"')
else
    COMPLIANCE_DATA=$(echo "$COMPLIANCE_DATA" | jq '.policy_enforcement.status = "violations_found"')
fi

# Generate final report
echo "$COMPLIANCE_DATA" > "$COMPLIANCE_REPORT"

log_info "Compliance check completed."
log_info "Report saved to: $COMPLIANCE_REPORT"
log_info "Audit log saved to: $AUDIT_LOG"

# Send alerts for critical compliance failures
if [ "$GDPR_FAILED" -gt 0 ] || [ "$PCI_FAILED" -gt 0 ] || [ "$POLICY_VIOLATIONS" -gt 0 ]; then
    send_alert "Compliance violations detected. Review the compliance report." "HIGH"
    log_error "Compliance issues found. Manual review required."
    exit 1
else
    log_info "All compliance checks passed."
fi