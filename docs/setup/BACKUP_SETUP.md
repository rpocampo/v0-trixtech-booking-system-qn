# Backup Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Backup Strategy Overview](#backup-strategy-overview)
4. [Database Backup Setup](#database-backup-setup)
5. [File System Backup Setup](#file-system-backup-setup)
6. [Backup Scheduling](#backup-scheduling)
7. [Storage Configuration](#storage-configuration)
8. [Backup Verification](#backup-verification)
9. [Troubleshooting](#troubleshooting)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for setting up automated backup systems for the TRIXTECH Booking System. The backup solution ensures data integrity, disaster recovery capabilities, and compliance with data retention policies through automated database dumps, file system snapshots, and offsite storage.

## Prerequisites

- Access to database server (PostgreSQL/MySQL)
- Cloud storage account (AWS S3, GCP Cloud Storage, or Azure Blob Storage)
- Backup server or cron-capable environment
- Database admin credentials
- Storage access keys/tokens
- Monitoring and alerting system

### Required Tools

- `pg_dump` for PostgreSQL backups
- `mysqldump` for MySQL backups (if applicable)
- `rsync` or `rclone` for file synchronization
- `cron` or similar scheduler
- Cloud storage CLI tools (awscli, gsutil, azcopy)

### Environment Variables

Set the following environment variables:

```bash
export DB_HOST="your-database-host"
export DB_PORT="5432"
export DB_NAME="trixtech_booking"
export DB_USER="backup_user"
export DB_PASSWORD="secure_password"
export BACKUP_DIR="/opt/backups"
export S3_BUCKET="trixtech-backups"
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
```

## Backup Strategy Overview

### Backup Types

1. **Full Database Backups**: Complete database dumps
2. **Incremental Backups**: Changes since last backup
3. **File System Backups**: Application files, configurations, and uploads
4. **Configuration Backups**: Kubernetes manifests, environment files

### Retention Policy

- Daily backups: Retain 30 days
- Weekly backups: Retain 12 weeks
- Monthly backups: Retain 12 months
- Yearly backups: Retain 7 years

### Recovery Objectives

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour

## Database Backup Setup

### PostgreSQL Backup Script

Create `/opt/backup-scripts/db_backup.sh`:

```bash
#!/bin/bash

# Database Backup Script for TRIXTECH Booking System
# Version: 1.0.0

set -e

# Configuration
BACKUP_DIR="/opt/backups/database"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="trixtech_db_${TIMESTAMP}.sql.gz"
LOG_FILE="/var/log/backup/db_backup.log"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting database backup: $BACKUP_NAME"

# Perform backup with compression
pg_dump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --username="$DB_USER" \
    --dbname="$DB_NAME" \
    --no-password \
    --format=custom \
    --compress=9 \
    --file="$BACKUP_DIR/$BACKUP_NAME" \
    --verbose

# Verify backup integrity
log "Verifying backup integrity..."
pg_restore --list "$BACKUP_DIR/$BACKUP_NAME" > /dev/null

# Calculate backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
log "Backup completed successfully. Size: $BACKUP_SIZE"

# Clean up old backups (keep last 30 daily backups)
find "$BACKUP_DIR" -name "trixtech_db_*.sql.gz" -mtime +30 -delete

log "Database backup process completed"
```

### MySQL Backup Script (Alternative)

If using MySQL:

```bash
#!/bin/bash

# MySQL Database Backup Script
mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --password="$DB_PASSWORD" \
    --databases "$DB_NAME" \
    --single-transaction \
    --routines \
    --triggers \
    --compress \
    | gzip > "$BACKUP_DIR/trixtech_db_${TIMESTAMP}.sql.gz"
```

## File System Backup Setup

### Application Files Backup

Create `/opt/backup-scripts/files_backup.sh`:

```bash
#!/bin/bash

# File System Backup Script
set -e

BACKUP_DIR="/opt/backups/files"
SOURCE_DIR="/opt/trixtech"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="trixtech_files_${TIMESTAMP}.tar.gz"
LOG_FILE="/var/log/backup/files_backup.log"

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting file system backup"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Exclude patterns
EXCLUDE_FILE="/tmp/backup_exclude.txt"
cat > "$EXCLUDE_FILE" << EOF
node_modules
.git
*.log
tmp/*
cache/*
EOF

# Create compressed archive
tar \
    --exclude-from="$EXCLUDE_FILE" \
    --exclude-vcs \
    --exclude-backups \
    -czf "$BACKUP_DIR/$BACKUP_NAME" \
    -C "$SOURCE_DIR" \
    .

# Verify backup
log "Verifying backup integrity..."
tar -tzf "$BACKUP_DIR/$BACKUP_NAME" > /dev/null

BACKUP_SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)
log "File backup completed. Size: $BACKUP_SIZE"

# Cleanup
rm "$EXCLUDE_FILE"
find "$BACKUP_DIR" -name "trixtech_files_*.tar.gz" -mtime +30 -delete

log "File system backup completed"
```

### Kubernetes Configuration Backup

Create `/opt/backup-scripts/k8s_backup.sh`:

```bash
#!/bin/bash

# Kubernetes Configuration Backup
BACKUP_DIR="/opt/backups/kubernetes"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

# Backup all resources
kubectl get all --all-namespaces -o yaml > "$BACKUP_DIR/k8s_resources_${TIMESTAMP}.yaml"

# Backup persistent volumes
kubectl get pv,pvc --all-namespaces -o yaml > "$BACKUP_DIR/persistent_volumes_${TIMESTAMP}.yaml"

# Backup secrets (be careful with sensitive data)
kubectl get secrets --all-namespaces -o yaml > "$BACKUP_DIR/secrets_${TIMESTAMP}.yaml"

# Compress backups
tar -czf "$BACKUP_DIR/k8s_backup_${TIMESTAMP}.tar.gz" "$BACKUP_DIR"/*.yaml
rm "$BACKUP_DIR"/*.yaml
```

## Backup Scheduling

### Cron Job Configuration

Edit crontab with `crontab -e`:

```bash
# TRIXTECH Backup Schedule
# Database backup - Daily at 2:00 AM
0 2 * * * /opt/backup-scripts/db_backup.sh

# File system backup - Daily at 3:00 AM
0 3 * * * /opt/backup-scripts/files_backup.sh

# Kubernetes config backup - Weekly on Sunday at 4:00 AM
0 4 * * 0 /opt/backup-scripts/k8s_backup.sh

# Backup sync to cloud - Daily at 5:00 AM
0 5 * * * /opt/backup-scripts/cloud_sync.sh
```

### systemd Timer (Alternative)

Create `/etc/systemd/system/trixtech-backup.service`:

```ini
[Unit]
Description=TRIXTECH Database Backup
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/backup-scripts/db_backup.sh
User=backup
Group=backup
```

Create `/etc/systemd/system/trixtech-backup.timer`:

```ini
[Unit]
Description=Run TRIXTECH backup daily
Requires=trixtech-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start the timer:

```bash
sudo systemctl enable trixtech-backup.timer
sudo systemctl start trixtech-backup.timer
```

## Storage Configuration

### AWS S3 Setup

Create `/opt/backup-scripts/cloud_sync.sh`:

```bash
#!/bin/bash

# Cloud Storage Sync Script
set -e

LOCAL_BACKUP_DIR="/opt/backups"
S3_BUCKET="trixtech-backups"
LOG_FILE="/var/log/backup/cloud_sync.log"

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting cloud sync to S3"

# Sync database backups
aws s3 sync "$LOCAL_BACKUP_DIR/database/" "s3://$S3_BUCKET/database/" \
    --delete \
    --storage-class STANDARD_IA

# Sync file backups
aws s3 sync "$LOCAL_BACKUP_DIR/files/" "s3://$S3_BUCKET/files/" \
    --delete \
    --storage-class STANDARD_IA

# Sync Kubernetes backups (weekly)
if [ $(date +%u) -eq 7 ]; then
    aws s3 sync "$LOCAL_BACKUP_DIR/kubernetes/" "s3://$S3_BUCKET/kubernetes/" \
        --delete \
        --storage-class GLACIER
fi

log "Cloud sync completed successfully"
```

### Google Cloud Storage Setup

For GCP:

```bash
#!/bin/bash

# GCP Cloud Storage Sync
gsutil -m rsync -r "$LOCAL_BACKUP_DIR" "gs://$BUCKET_NAME/backups/"
```

### Azure Blob Storage Setup

For Azure:

```bash
#!/bin/bash

# Azure Blob Storage Sync
azcopy sync "$LOCAL_BACKUP_DIR" "https://$STORAGE_ACCOUNT.blob.core.windows.net/$CONTAINER" --recursive
```

## Backup Verification

### Automated Verification Script

Create `/opt/backup-scripts/verify_backups.sh`:

```bash
#!/bin/bash

# Backup Verification Script
set -e

BACKUP_DIR="/opt/backups"
LOG_FILE="/var/log/backup/verification.log"
THRESHOLD_HOURS=25  # Alert if backup older than 25 hours

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

# Check database backups
LATEST_DB=$(find "$BACKUP_DIR/database" -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -z "$LATEST_DB" ]; then
    log "ERROR: No database backups found!"
    exit 1
fi

DB_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_DB")) / 3600 ))
if [ $DB_AGE_HOURS -gt $THRESHOLD_HOURS ]; then
    log "WARNING: Latest database backup is $DB_AGE_HOURS hours old"
fi

# Test database backup integrity
log "Testing database backup integrity..."
pg_restore --list "$LATEST_DB" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    log "Database backup integrity check passed"
else
    log "ERROR: Database backup integrity check failed!"
    exit 1
fi

# Check file system backups
LATEST_FILES=$(find "$BACKUP_DIR/files" -name "*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_FILES" ]; then
    FILES_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_FILES")) / 3600 ))
    if [ $FILES_AGE_HOURS -gt $THRESHOLD_HOURS ]; then
        log "WARNING: Latest file backup is $FILES_AGE_HOURS hours old"
    fi
fi

log "Backup verification completed successfully"
```

### Monitoring Integration

Add to monitoring system:

```yaml
# Prometheus alert rule
groups:
- name: backup_alerts
  rules:
  - alert: BackupFailed
    expr: backup_status{job="backup_verification"} == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Backup verification failed"
      description: "Backup verification job has failed"

  - alert: BackupTooOld
    expr: backup_age_hours > 25
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Backup is too old"
      description: "Latest backup is older than 25 hours"
```

## Troubleshooting

### Common Issues

#### Database Connection Failures

**Symptoms:** pg_dump fails with connection errors

**Solutions:**
1. Verify database credentials and connectivity
2. Check firewall rules and security groups
3. Ensure backup user has appropriate permissions
4. Test connection manually: `psql -h $DB_HOST -U $DB_USER -d $DB_NAME`

#### Insufficient Disk Space

**Symptoms:** Backup fails with "No space left on device"

**Solutions:**
1. Monitor disk usage with `df -h`
2. Implement log rotation
3. Clean up old backups automatically
4. Add disk space monitoring alerts

#### Cloud Storage Upload Failures

**Symptoms:** Sync to cloud storage fails

**Solutions:**
1. Verify credentials and permissions
2. Check network connectivity
3. Validate bucket/container exists
4. Test manual upload: `aws s3 ls s3://$BUCKET`

#### Permission Issues

**Symptoms:** Scripts fail with permission denied

**Solutions:**
1. Ensure scripts are executable: `chmod +x script.sh`
2. Run as appropriate user with sudo if needed
3. Check file ownership and permissions
4. Verify cron user has access to required directories

#### Backup Corruption

**Symptoms:** Verification fails with corruption errors

**Solutions:**
1. Test backup restoration manually
2. Check available memory during backup
3. Verify network stability during transfer
4. Implement checksum validation

### Debugging Steps

1. Check log files in `/var/log/backup/`
2. Run scripts manually with verbose output
3. Test individual components (database connection, file access, cloud sync)
4. Verify environment variables and configuration files
5. Check system resources (CPU, memory, disk space)

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Backup Maintenance](../maintenance/BACKUP_MAINTENANCE.md)
- [Backup Troubleshooting](../troubleshooting/BACKUP_TROUBLESHOOTING.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review and update backup scripts quarterly. Test restoration procedures annually. Update retention policies based on business requirements and compliance needs.