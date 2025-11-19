#!/bin/bash

# TRIXTECH Production Backup Script
# This script creates backups of database and uploaded files

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/var/backups/trixtech"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database configuration
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"27017"}
DB_NAME=${DB_NAME:-"trixtech_prod"}
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/uploads"

echo "Starting TRIXTECH backup at $(date)"

# Database backup
echo "Creating database backup..."
if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ]; then
    mongodump --host "$DB_HOST" --port "$DB_PORT" --username "$DB_USER" --password "$DB_PASS" --db "$DB_NAME" --out "$BACKUP_DIR/database/backup_$DATE"
else
    mongodump --host "$DB_HOST" --port "$DB_PORT" --db "$DB_NAME" --out "$BACKUP_DIR/database/backup_$DATE"
fi

# Compress database backup
echo "Compressing database backup..."
tar -czf "$BACKUP_DIR/database/backup_$DATE.tar.gz" -C "$BACKUP_DIR/database" "backup_$DATE"
rm -rf "$BACKUP_DIR/database/backup_$DATE"

# File uploads backup
echo "Creating uploads backup..."
if [ -d "/var/www/uploads" ]; then
    tar -czf "$BACKUP_DIR/uploads/uploads_$DATE.tar.gz" -C "/var/www" uploads
fi

# Calculate backup size
DB_SIZE=$(du -sh "$BACKUP_DIR/database/backup_$DATE.tar.gz" | cut -f1)
UPLOAD_SIZE=$(du -sh "$BACKUP_DIR/uploads/uploads_$DATE.tar.gz" 2>/dev/null | cut -f1)

echo "Database backup size: $DB_SIZE"
echo "Uploads backup size: ${UPLOAD_SIZE:-'0 (no uploads)'}"

# Clean up old backups
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete

# Verify backup integrity
echo "Verifying backup integrity..."
if [ -f "$BACKUP_DIR/database/backup_$DATE.tar.gz" ]; then
    if tar -tzf "$BACKUP_DIR/database/backup_$DATE.tar.gz" >/dev/null 2>&1; then
        echo "✅ Database backup integrity check passed"
    else
        echo "❌ Database backup integrity check failed"
        exit 1
    fi
fi

if [ -f "$BACKUP_DIR/uploads/uploads_$DATE.tar.gz" ]; then
    if tar -tzf "$BACKUP_DIR/uploads/uploads_$DATE.tar.gz" >/dev/null 2>&1; then
        echo "✅ Uploads backup integrity check passed"
    else
        echo "❌ Uploads backup integrity check failed"
        exit 1
    fi
fi

# Send notification (if configured)
if [ -n "$ADMIN_EMAIL" ]; then
    echo "Backup completed successfully at $(date)" | mail -s "TRIXTECH Backup Completed" "$ADMIN_EMAIL"
fi

echo "✅ TRIXTECH backup completed successfully at $(date)"
echo "Backup location: $BACKUP_DIR"