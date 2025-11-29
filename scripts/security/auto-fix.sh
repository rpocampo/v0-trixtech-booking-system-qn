#!/bin/bash

# TRIXTECH Booking System - Automated Security Fixes
# This script applies automated fixes for known vulnerabilities:
# - Apply automated fixes for known vulnerabilities
# - Update security headers and configurations
# - Patch management for system packages
# - Validate fixes with re-scanning

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_ROOT/backups/auto_fix_$TIMESTAMP"
LOG_FILE="$PROJECT_ROOT/logs/auto_fix_$TIMESTAMP.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to send notification
send_notification() {
    local message=$1
    local status=$2

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"TRIXTECH Auto Fix [$status]: $message\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi

    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "TRIXTECH Auto Fix [$status]" "$EMAIL_RECIPIENT" || true
    fi
}

# Function to create backup
create_backup() {
    local file=$1
    local backup_file="$BACKUP_DIR/$(basename "$file").backup"

    if [ -f "$file" ]; then
        mkdir -p "$BACKUP_DIR"
        cp "$file" "$backup_file"
        log_info "Backup created: $backup_file"
    fi
}

# Function to validate fixes
validate_fixes() {
    log_info "Validating fixes by re-running vulnerability scan..."

    # Run vulnerability scan
    if "$SCRIPT_DIR/vulnerability-scan.sh"; then
        log_info "Validation passed - no critical vulnerabilities remain."
        return 0
    else
        log_error "Validation failed - vulnerabilities still present."
        return 1
    fi
}

# Create directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

log_info "Starting automated security fixes..."
send_notification "Automated security fixes started" "STARTED"

# 1. Apply automated fixes for known vulnerabilities
log_info "Applying automated fixes for known vulnerabilities..."

# Backend fixes
cd "$PROJECT_ROOT/backend"

# Backup package files
create_backup "package.json"
create_backup "package-lock.json"

# Run npm audit fix
log_info "Running npm audit fix for backend..."
if npm audit fix --audit-level=moderate; then
    log_info "Backend npm audit fix completed successfully."
else
    log_warn "Backend npm audit fix encountered issues."
fi

# Frontend fixes
cd "$PROJECT_ROOT/frontend"

# Backup package files
create_backup "package.json"
create_backup "package-lock.json"

# Run npm audit fix
log_info "Running npm audit fix for frontend..."
if npm audit fix --audit-level=moderate; then
    log_info "Frontend npm audit fix completed successfully."
else
    log_warn "Frontend npm audit fix encountered issues."
fi

# 2. Update security headers and configurations
log_info "Updating security headers and configurations..."

# Backend security headers (Express)
BACKEND_APP_FILE="$PROJECT_ROOT/backend/server.js"
if [ -f "$BACKEND_APP_FILE" ]; then
    create_backup "$BACKEND_APP_FILE"

    # Check if helmet is installed
    if ! grep -q "helmet" package.json; then
        log_info "Installing helmet for security headers..."
        npm install helmet
    fi

    # Add helmet middleware if not present
    if ! grep -q "helmet" "$BACKEND_APP_FILE"; then
        log_info "Adding helmet middleware to backend..."
        # This is a simple addition - in practice, you'd need more sophisticated parsing
        sed -i '1s/^/const helmet = require("helmet");\n/' "$BACKEND_APP_FILE"
        sed -i '/app\.use(/a app.use(helmet());' "$BACKEND_APP_FILE"
        log_info "Helmet middleware added to backend."
    fi
fi

# Frontend security headers (Next.js)
NEXT_CONFIG_FILE="$PROJECT_ROOT/frontend/next.config.js"
if [ -f "$NEXT_CONFIG_FILE" ]; then
    create_backup "$NEXT_CONFIG_FILE"

    # Add security headers to Next.js config
    if ! grep -q "security" "$NEXT_CONFIG_FILE"; then
        log_info "Adding security headers to Next.js config..."
        cat >> "$NEXT_CONFIG_FILE" << 'EOF'

// Security headers
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  // ... other config
}
EOF
        log_info "Security headers added to Next.js config."
    fi
fi

# 3. Patch management for system packages
log_info "Checking for system package updates..."

# Detect package manager
if command -v apt-get &> /dev/null; then
    log_info "Using apt-get for system updates..."
    # Update package list
    sudo apt-get update

    # Get list of upgradable packages
    UPGRADABLE=$(apt-get --just-print upgrade | grep "^Inst" | wc -l)
    log_info "Found $UPGRADABLE upgradable system packages."

    if [ "$UPGRADABLE" -gt 0 ]; then
        log_info "Applying system package updates..."
        sudo apt-get upgrade -y
        log_info "System packages updated successfully."
    else
        log_info "No system packages to update."
    fi

    # Update security packages specifically
    sudo apt-get install --only-upgrade -y $(apt-get --just-print upgrade | grep "^Inst" | grep -i security | awk '{print $2}')

elif command -v yum &> /dev/null; then
    log_info "Using yum for system updates..."
    sudo yum update -y
    log_info "System packages updated with yum."

elif command -v dnf &> /dev/null; then
    log_info "Using dnf for system updates..."
    sudo dnf update -y
    log_info "System packages updated with dnf."

else
    log_warn "No supported package manager found (apt-get, yum, dnf). Skipping system updates."
fi

# 4. Validate fixes with re-scanning
log_info "Validating applied fixes..."

if validate_fixes; then
    log_info "All fixes validated successfully."
    send_notification "Automated security fixes completed successfully" "SUCCESS"
else
    log_error "Some fixes may not have been applied correctly."
    send_notification "Automated security fixes completed with validation warnings" "WARNING"
fi

# Generate summary report
SUMMARY_FILE="$PROJECT_ROOT/reports/security/auto_fix_summary_$TIMESTAMP.txt"
mkdir -p "$(dirname "$SUMMARY_FILE")"

cat > "$SUMMARY_FILE" << EOF
TRIXTECH Automated Security Fixes Summary
=========================================

Timestamp: $(date)
Environment: $ENVIRONMENT
Backup Location: $BACKUP_DIR
Log File: $LOG_FILE

Actions Performed:
- Applied npm audit fixes for backend and frontend
- Updated security headers in Express and Next.js
- Applied system package updates
- Validated fixes with re-scanning

Backup Files:
$(ls -la "$BACKUP_DIR" 2>/dev/null || echo "No backups created")

For rollback, restore files from: $BACKUP_DIR

Log Details:
$(tail -20 "$LOG_FILE")
EOF

log_info "Summary report saved to: $SUMMARY_FILE"

log_info "Automated security fixes completed."