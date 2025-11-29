# Maintenance Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Database Maintenance](#database-maintenance)
4. [Log Management](#log-management)
5. [System Updates](#system-updates)
6. [Storage Maintenance](#storage-maintenance)
7. [Application Maintenance](#application-maintenance)
8. [Scheduled Maintenance Windows](#scheduled-maintenance-windows)
9. [Maintenance Monitoring](#maintenance-monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for setting up automated maintenance procedures for the TRIXTECH Booking System. Scheduled maintenance ensures optimal system performance, security, and reliability through regular cleanup, optimization, and update processes.

## Prerequisites

- Kubernetes cluster access with admin privileges
- Database admin access
- Cron job scheduling capabilities
- Monitoring and alerting system
- Backup systems in place
- Maintenance window scheduling system

### Required Tools

- `kubectl` for Kubernetes operations
- Database client tools (psql, pg_dump)
- Log rotation utilities (logrotate)
- Package managers (apt, yum, etc.)
- Cron or Kubernetes CronJobs

## Database Maintenance

### PostgreSQL Maintenance Setup

Create database maintenance scripts:

```bash
#!/bin/bash
# PostgreSQL Maintenance Script
# File: /opt/maintenance/db_maintenance.sh

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-trixtech}"
DB_USER="${DB_USER:-postgres}"
LOG_FILE="/var/log/maintenance/db_maintenance.log"

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting database maintenance for $DB_NAME"

# Vacuum analyze for statistics update
log "Running VACUUM ANALYZE..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "VACUUM ANALYZE;"

# Reindex system catalogs
log "Reindexing system catalogs..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "REINDEX SYSTEM $DB_NAME;"

# Check for bloated tables
log "Checking for table bloat..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF' >> "$LOG_FILE"
SELECT
    schemaname,
    tablename,
    n_dead_tup,
    n_live_tup,
    ROUND(n_dead_tup::float / (n_live_tup + n_dead_tup) * 100, 2) as bloat_ratio
FROM pg_stat_user_tables
WHERE n_dead_tup > 0
ORDER BY bloat_ratio DESC
LIMIT 10;
EOF

# Archive old data (example: older than 2 years)
log "Archiving old booking data..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'
-- Create archive table if not exists
CREATE TABLE IF NOT EXISTS bookings_archive (
    LIKE bookings INCLUDING ALL
);

-- Move old records (adjust date as needed)
INSERT INTO bookings_archive
SELECT * FROM bookings
WHERE created_at < CURRENT_DATE - INTERVAL '2 years';

-- Remove from main table
DELETE FROM bookings
WHERE created_at < CURRENT_DATE - INTERVAL '2 years';
EOF

log "Database maintenance completed"
```

### Automated Database Maintenance CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-maintenance-weekly
  namespace: database
spec:
  schedule: "0 2 * * 0"  # Every Sunday at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: db-maintenance
            image: postgres:13
            command:
            - /bin/bash
            - -c
            - |
              # Install maintenance script
              apt-get update && apt-get install -y curl
              curl -o /tmp/db_maintenance.sh https://raw.githubusercontent.com/trixtech/maintenance/main/db_maintenance.sh
              chmod +x /tmp/db_maintenance.sh

              # Run maintenance
              /tmp/db_maintenance.sh
            env:
            - name: DB_HOST
              value: "postgres.database.svc.cluster.local"
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: username
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: password
          restartPolicy: OnFailure
```

## Log Management

### Log Rotation Configuration

Create logrotate configuration:

```bash
# /etc/logrotate.d/trixtech
/var/log/trixtech/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 trixtech trixtech
    postrotate
        systemctl reload trixtech-backend || true
    endscript
}

/var/log/trixtech/application.log {
    weekly
    missingok
    rotate 12
    compress
    delaycompress
    notifempty
    create 644 trixtech trixtech
    postrotate
        kill -HUP $(cat /var/run/trixtech/backend.pid 2>/dev/null) 2>/dev/null || true
    endscript
}
```

### Kubernetes Log Management

Implement log aggregation and rotation:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-config
  namespace: default
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Log_Level     info
        Daemon        off

    [INPUT]
        Name              tail
        Path              /var/log/containers/*trixtech*.log
        Parser            docker
        Tag               trixtech.*
        Refresh_Interval  5

    [OUTPUT]
        Name  elasticsearch
        Match trixtech.*
        Host  elasticsearch.logging.svc.cluster.local
        Port  9200
        Index trixtech-logs
        Type  _doc

    [OUTPUT]
        Name  file
        Match trixtech.*
        Path  /var/log/fluent-bit/
        Format template
        Template {time} {message}
```

### Log Cleanup CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: log-cleanup-daily
  namespace: default
spec:
  schedule: "0 1 * * *"  # Daily at 1 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: log-cleanup
            image: busybox
            command:
            - sh
            - -c
            - |
              # Clean old application logs (older than 30 days)
              find /var/log/trixtech -name "*.log" -mtime +30 -delete

              # Clean old archived logs (older than 90 days)
              find /var/log/trixtech/archive -name "*.gz" -mtime +90 -delete

              # Clean old Kubernetes logs
              find /var/log/containers -name "*trixtech*" -mtime +7 -delete

              echo "Log cleanup completed"
          volumeMounts:
          - name: log-volume
            mountPath: /var/log
          restartPolicy: OnFailure
```

## System Updates

### Automated Package Updates

Create update script:

```bash
#!/bin/bash
# System Update Script
# File: /opt/maintenance/system_update.sh

set -e

LOG_FILE="/var/log/maintenance/system_updates.log"

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting system updates"

# Update package lists
log "Updating package lists..."
apt-get update

# Upgrade packages (unattended)
log "Upgrading packages..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::="--force-confold"

# Clean up
log "Cleaning up..."
apt-get autoremove -y
apt-get autoclean

# Check for security updates
log "Checking security updates..."
apt-get install -y unattended-upgrades
unattended-upgrades --dry-run

log "System updates completed"
```

### Kubernetes Node Updates

Create node update procedure:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: node-update-job
  namespace: kube-system
spec:
  template:
    spec:
      serviceAccountName: node-updater
      containers:
      - name: node-updater
        image: bitnami/kubectl
        command:
        - sh
        - -c
        - |
          # Cordon node for maintenance
          kubectl cordon $(hostname)

          # Drain pods
          kubectl drain $(hostname) --ignore-daemonsets --delete-emptydir-data

          # Update node (this would be called by external automation)
          echo "Node $(hostname) ready for update"

          # Uncordon after update
          kubectl uncordon $(hostname)
      restartPolicy: Never
```

### Application Updates

Automated application update CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: app-update-weekly
  namespace: default
spec:
  schedule: "0 3 * * 0"  # Sunday 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: app-updater
          containers:
          - name: app-updater
            image: bitnami/kubectl
            command:
            - sh
            - -c
            - |
              # Check for new images
              LATEST_BACKEND=$(curl -s https://registry.hub.docker.com/v2/repositories/trixtech/backend/tags | jq -r '.results[0].name')
              CURRENT_BACKEND=$(kubectl get deployment trixtech-backend -o jsonpath='{.spec.template.spec.containers[0].image}' | cut -d: -f2)

              if [ "$LATEST_BACKEND" != "$CURRENT_BACKEND" ]; then
                echo "Updating backend from $CURRENT_BACKEND to $LATEST_BACKEND"
                kubectl set image deployment/trixtech-backend backend=trixtech/backend:$LATEST_BACKEND
                kubectl rollout status deployment/trixtech-backend
              fi
          restartPolicy: OnFailure
```

## Storage Maintenance

### Disk Cleanup

Automated disk cleanup script:

```bash
#!/bin/bash
# Disk Cleanup Script
# File: /opt/maintenance/disk_cleanup.sh

set -e

LOG_FILE="/var/log/maintenance/disk_cleanup.log"
THRESHOLD=80  # Alert if usage above 80%

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting disk cleanup"

# Check disk usage
USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "$USAGE" -gt "$THRESHOLD" ]; then
    log "Disk usage is ${USAGE}%, running cleanup"

    # Clean package cache
    apt-get clean
    apt-get autoclean

    # Clean old kernels
    current_kernel=$(uname -r)
    old_kernels=$(dpkg -l | grep linux-image | grep -v "$current_kernel" | awk '{print $2}')
    if [ -n "$old_kernels" ]; then
        echo "$old_kernels" | xargs apt-get purge -y
    fi

    # Clean Docker
    docker system prune -f

    # Clean temporary files
    find /tmp -type f -mtime +7 -delete
    find /var/tmp -type f -mtime +7 -delete

    # Clean old log files
    find /var/log -name "*.gz" -mtime +30 -delete
    find /var/log -name "*.old" -mtime +30 -delete

    log "Disk cleanup completed"
else
    log "Disk usage is ${USAGE}%, no cleanup needed"
fi
```

### Storage Optimization

Kubernetes storage maintenance:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: storage-maintenance
  namespace: default
spec:
  schedule: "0 4 * * 0"  # Weekly Sunday 4 AM
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: storage-admin
          containers:
          - name: storage-maintenance
            image: bitnami/kubectl
            command:
            - sh
            - -c
            - |
              # Clean up orphaned PVCs
              kubectl get pvc --all-namespaces | grep Released | awk '{print $1, $2}' | while read ns pvc; do
                kubectl delete pvc "$pvc" -n "$ns"
              done

              # Clean up completed jobs
              kubectl delete jobs --field-selector status.successful=1 --all-namespaces

              # Clean up old replicasets
              kubectl get rs --all-namespaces | grep "0 0 0" | awk '{print $1, $2}' | while read ns rs; do
                kubectl delete rs "$rs" -n "$ns"
              done
          restartPolicy: OnFailure
```

## Application Maintenance

### Cache Cleanup

Application-specific cleanup:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: app-cache-cleanup
  namespace: default
spec:
  schedule: "0 */6 * * *"  # Every 6 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cache-cleanup
            image: curlimages/curl
            command:
            - sh
            - -c
            - |
              # Clear application cache via API
              curl -X POST http://trixtech-backend:3000/admin/cache/clear \
                -H "Authorization: Bearer $ADMIN_TOKEN"

              # Clear Redis cache if applicable
              # redis-cli FLUSHDB
          env:
          - name: ADMIN_TOKEN
            valueFrom:
              secretKeyRef:
                name: admin-secret
                key: token
          restartPolicy: OnFailure
```

### Session Cleanup

Clean expired sessions:

```javascript
// backend/scripts/cleanupSessions.js
const pool = require('../config/database');

async function cleanupExpiredSessions() {
  try {
    const query = `
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
    `;

    const result = await pool.query(query);
    console.log(`Cleaned up ${result.rowCount} expired sessions`);

    // Also clean old password reset tokens
    await pool.query(`
      DELETE FROM password_reset_tokens
      WHERE expires_at < NOW()
    `);

    console.log('Session cleanup completed');
  } catch (error) {
    console.error('Session cleanup failed:', error);
    process.exit(1);
  }
}

cleanupExpiredSessions();
```

## Scheduled Maintenance Windows

### Maintenance Window Configuration

Create maintenance window ConfigMap:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: maintenance-windows
  namespace: default
data:
  weekly-maintenance: "sunday 02:00-04:00 UTC"
  monthly-maintenance: "1st 01:00-03:00 UTC"
  emergency-maintenance: "anytime with 24h notice"
  business-hours: "monday-friday 08:00-18:00 UTC"
```

### Maintenance Notifications

Automated notification system:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: maintenance-notification
  namespace: default
spec:
  schedule: "0 1 * * 0"  # Sunday 1 AM (1 hour before maintenance)
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: notification
            image: curlimages/curl
            command:
            - sh
            - -c
            - |
              # Send maintenance notification
              curl -X POST https://api.slack.com/webhooks/your-webhook \
                -H 'Content-type: application/json' \
                -d '{
                  "text": "Scheduled maintenance starting in 1 hour: Sunday 2-4 AM UTC"
                }'
          restartPolicy: OnFailure
```

## Maintenance Monitoring

### Maintenance Metrics

Track maintenance effectiveness:

```yaml
# Prometheus metrics for maintenance
groups:
- name: maintenance_metrics
  rules:
  - record: maintenance_job_success_rate
    expr: rate(maintenance_job_status{status="success"}[7d]) / rate(maintenance_job_status[7d])

  - record: disk_usage_trend
    expr: predict_linear(disk_usage_percent[1h], 3600 * 24 * 7)

  - record: database_bloat_ratio
    expr: pg_stat_user_tables_n_dead_tup / (pg_stat_user_tables_n_live_tup + pg_stat_user_tables_n_dead_tup)
```

### Maintenance Alerts

Create alerts for maintenance issues:

```yaml
groups:
- name: maintenance_alerts
  rules:
  - alert: MaintenanceJobFailed
    expr: maintenance_job_status{status="failed"} == 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Maintenance job failed"
      description: "Maintenance job {{ $labels.job }} failed to complete"

  - alert: HighDiskUsage
    expr: disk_usage_percent > 85
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "High disk usage"
      description: "Disk usage is {{ $value }}% on {{ $labels.instance }}"

  - alert: DatabaseBloatHigh
    expr: database_bloat_ratio > 0.2
    for: 1h
    labels:
      severity: warning
    annotations:
      summary: "High database bloat"
      description: "Database bloat ratio is {{ $value }} for {{ $labels.table }}"

  - alert: MaintenanceWindowApproaching
    expr: time() % 604800 < 3600  # Within 1 hour of weekly maintenance
    for: 5m
    labels:
      severity: info
    annotations:
      summary: "Maintenance window approaching"
      description: "Scheduled maintenance starts in less than 1 hour"
```

## Troubleshooting

### Common Issues

#### Maintenance Jobs Failing

**Symptoms:** CronJobs or Jobs failing to complete

**Solutions:**
1. Check pod logs: `kubectl logs job/maintenance-job-xxxxx`
2. Verify service account permissions
3. Test scripts manually in debug mode
4. Check resource constraints

#### Database Maintenance Blocking

**Symptoms:** VACUUM operations taking too long

**Solutions:**
1. Run during low-traffic windows
2. Use VACUUM ANALYZE instead of full VACUUM
3. Implement table partitioning
4. Monitor long-running queries

#### Log Rotation Issues

**Symptoms:** Logs not rotating or growing too large

**Solutions:**
1. Check logrotate configuration syntax
2. Verify file permissions
3. Test rotation manually: `logrotate -f /etc/logrotate.d/trixtech`
4. Adjust rotation parameters

#### Update Failures

**Symptoms:** Package updates failing

**Solutions:**
1. Check network connectivity
2. Verify repository configurations
3. Resolve dependency conflicts
4. Test updates in staging first

#### Storage Full Issues

**Symptoms:** Disk space running low

**Solutions:**
1. Identify large files: `du -h / | sort -hr | head -20`
2. Clean old backups and logs
3. Implement log compression
4. Add disk space monitoring

### Debugging Steps

1. Check maintenance job status: `kubectl get jobs -n default`
2. View maintenance logs: `kubectl logs -l job-name=maintenance-job`
3. Test maintenance scripts manually
4. Check system resources during maintenance
5. Verify cron schedules: `crontab -l`

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Routine Maintenance](../maintenance/ROUTINE_MAINTENANCE.md)
- [Backup Setup](../setup/BACKUP_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review maintenance schedules quarterly. Adjust cleanup policies based on growth patterns. Test all maintenance procedures in staging before production deployment.