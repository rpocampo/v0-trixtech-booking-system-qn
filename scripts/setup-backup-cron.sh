#!/bin/bash

# Setup automated backup cron job for TRIXTECH
# Run this script as root or with sudo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"

# Create log directory
mkdir -p /var/log/trixtech

# Create cron job for daily backups at 2 AM
CRON_JOB="0 2 * * * $BACKUP_SCRIPT >> /var/log/trixtech/backup.log 2>&1"

# Check if cron job already exists
if crontab -l | grep -q "$BACKUP_SCRIPT"; then
    echo "Backup cron job already exists"
else
    # Add cron job
    (crontab -l ; echo "$CRON_JOB") | crontab -
    echo "✅ Backup cron job added successfully"
    echo "Daily backups will run at 2:00 AM"
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Test backup script
echo "Testing backup script..."
if sudo -u $(whoami) "$BACKUP_SCRIPT"; then
    echo "✅ Backup script test successful"
else
    echo "❌ Backup script test failed"
    exit 1
fi

echo "Backup automation setup complete!"
echo "Check /var/log/trixtech/backup.log for backup logs"