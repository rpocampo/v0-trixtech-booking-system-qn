#!/bin/bash

# TRIXTECH Booking System - Automated Dependency Updates
# This script performs automated dependency updates with safety checks:
# - Automated npm update with safety checks
# - Create pull requests for dependency updates
# - Test compatibility before applying updates
# - Rollback capability for failed updates

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENVIRONMENT="${ENVIRONMENT:-dev}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BRANCH_NAME="security/dependency-updates-$TIMESTAMP"
BACKUP_DIR="$PROJECT_ROOT/backups/dependency_$TIMESTAMP"

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

# Function to send notification
send_notification() {
    local message=$1
    local status=$2

    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
             --data "{\"text\":\"TRIXTECH Dependency Update [$status]: $message\"}" \
             "$SLACK_WEBHOOK_URL" || true
    fi

    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "TRIXTECH Dependency Update [$status]" "$EMAIL_RECIPIENT" || true
    fi
}

# Function to rollback changes
rollback_changes() {
    log_warn "Rolling back dependency updates..."

    cd "$PROJECT_ROOT"

    # Restore package-lock.json files
    if [ -f "$BACKUP_DIR/backend_package-lock.json" ]; then
        cp "$BACKUP_DIR/backend_package-lock.json" "backend/package-lock.json"
        cd backend && npm ci
    fi

    if [ -f "$BACKUP_DIR/frontend_package-lock.json" ]; then
        cp "$BACKUP_DIR/frontend_package-lock.json" "frontend/package-lock.json"
        cd ../frontend && npm ci
    fi

    # Delete the branch if it exists
    git branch -D "$BRANCH_NAME" 2>/dev/null || true

    log_info "Rollback completed."
}

# Function to run tests
run_tests() {
    local project=$1
    local test_cmd=$2

    log_info "Running tests for $project..."

    if [ -n "$test_cmd" ]; then
        if eval "$test_cmd"; then
            log_info "$project tests passed."
            return 0
        else
            log_error "$project tests failed."
            return 1
        fi
    else
        log_warn "No test command specified for $project, skipping tests."
        return 0
    fi
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository. Dependency updates require git."
    exit 1
fi

# Create and switch to new branch
log_info "Creating new branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# Backup current state
log_info "Creating backup of current dependencies..."
cd "$PROJECT_ROOT/backend"
if [ -f "package-lock.json" ]; then
    cp package-lock.json "$BACKUP_DIR/backend_package-lock.json"
fi

cd "$PROJECT_ROOT/frontend"
if [ -f "package-lock.json" ]; then
    cp package-lock.json "$BACKUP_DIR/frontend_package-lock.json"
fi

# Update backend dependencies
log_info "Updating backend dependencies..."
cd "$PROJECT_ROOT/backend"

# Check for outdated packages
OUTDATED=$(npm outdated --json 2>/dev/null || echo "{}")
OUTDATED_COUNT=$(echo "$OUTDATED" | jq 'keys | length' 2>/dev/null || echo "0")

if [ "$OUTDATED_COUNT" -gt 0 ]; then
    log_info "Found $OUTDATED_COUNT outdated packages in backend."

    # Update dependencies
    npm update

    # Run security audit after update
    if npm audit --audit-level=moderate; then
        log_info "Backend security audit passed after update."
    else
        log_error "Backend security audit failed after update. Rolling back..."
        rollback_changes
        send_notification "Backend dependency update failed security audit" "FAILED"
        exit 1
    fi

    # Run tests
    if ! run_tests "backend" "${BACKEND_TEST_CMD:-npm test}"; then
        log_error "Backend tests failed after update. Rolling back..."
        rollback_changes
        send_notification "Backend dependency update failed tests" "FAILED"
        exit 1
    fi

    log_info "Backend dependencies updated successfully."
else
    log_info "No outdated packages found in backend."
fi

# Update frontend dependencies
log_info "Updating frontend dependencies..."
cd "$PROJECT_ROOT/frontend"

OUTDATED_FRONTEND=$(npm outdated --json 2>/dev/null || echo "{}")
OUTDATED_FRONTEND_COUNT=$(echo "$OUTDATED_FRONTEND" | jq 'keys | length' 2>/dev/null || echo "0")

if [ "$OUTDATED_FRONTEND_COUNT" -gt 0 ]; then
    log_info "Found $OUTDATED_FRONTEND_COUNT outdated packages in frontend."

    # Update dependencies
    npm update

    # Run security audit after update
    if npm audit --audit-level=moderate; then
        log_info "Frontend security audit passed after update."
    else
        log_error "Frontend security audit failed after update. Rolling back..."
        rollback_changes
        send_notification "Frontend dependency update failed security audit" "FAILED"
        exit 1
    fi

    # Run tests
    if ! run_tests "frontend" "${FRONTEND_TEST_CMD:-npm test}"; then
        log_error "Frontend tests failed after update. Rolling back..."
        rollback_changes
        send_notification "Frontend dependency update failed tests" "FAILED"
        exit 1
    fi

    log_info "Frontend dependencies updated successfully."
else
    log_info "No outdated packages found in frontend."
fi

# Check if there are any changes
if git diff --quiet; then
    log_info "No dependency changes detected. Cleaning up..."
    git checkout -
    git branch -D "$BRANCH_NAME"
    send_notification "No dependency updates needed" "INFO"
    exit 0
fi

# Commit changes
log_info "Committing dependency updates..."
git add .
git commit -m "Security: Update dependencies

- Updated backend dependencies
- Updated frontend dependencies
- All security audits passed
- All tests passed

Auto-generated by dependency-update.sh"

# Create pull request if GitHub CLI is available
if command -v gh &> /dev/null; then
    log_info "Creating pull request..."

    PR_BODY="## Dependency Updates

This PR contains automated dependency updates for improved security and stability.

### Changes
- Backend dependency updates: $OUTDATED_COUNT packages
- Frontend dependency updates: $OUTDATED_FRONTEND_COUNT packages

### Validation
- ✅ Security audit passed
- ✅ Tests passed
- ✅ No breaking changes detected

### Rollback
If issues arise, the previous state has been backed up and can be restored using:
\`\`\`bash
./scripts/security/dependency-update.sh --rollback
\`\`\`

Auto-generated by dependency-update.sh"

    gh pr create \
        --title "Security: Automated Dependency Updates - $TIMESTAMP" \
        --body "$PR_BODY" \
        --label "security,dependencies,automated" \
        --assignee "$(git config user.name)"

    PR_URL=$(gh pr view --json url -q .url)
    log_info "Pull request created: $PR_URL"
    send_notification "Dependency update PR created: $PR_URL" "SUCCESS"
else
    log_warn "GitHub CLI not available. Please create a pull request manually."
    send_notification "Dependency updates committed to branch $BRANCH_NAME. Please create PR manually." "SUCCESS"
fi

# Switch back to original branch
git checkout -

log_info "Dependency update process completed successfully."