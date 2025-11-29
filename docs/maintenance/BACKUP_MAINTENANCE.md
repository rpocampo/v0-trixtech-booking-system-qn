# Backup Maintenance Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Daily Backup Verification](#daily-backup-verification)
3. [Weekly Backup Maintenance](#weekly-backup-maintenance)
4. [Monthly Backup Testing](#monthly-backup-testing)
5. [Quarterly Backup Audits](#quarterly-backup-audits)
6. [Backup Restoration Procedures](#backup-restoration-procedures)
7. [Backup Cleanup Procedures](#backup-cleanup-procedures)
8. [Backup Monitoring and Alerting](#backup-monitoring-and-alerting)
9. [Disaster Recovery Testing](#disaster-recovery-testing)
10. [Troubleshooting](#troubleshooting)
11. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive procedures for maintaining, verifying, and testing backup systems for the TRIXTECH Booking System. Regular backup maintenance ensures data integrity, reliable recovery capabilities, and compliance with data retention policies.

## Daily Backup Verification

### Morning Backup Status Check (8:00 AM UTC)

**Objective:** Verify all scheduled backups completed successfully

**Duration:** 15 minutes

**Responsible:** On-call engineer

#### Verification Checklist:
- [ ] Confirm database backup completion
- [ ] Verify file system backup completion
- [ ] Check backup file sizes are reasonable
- [ ] Validate backup integrity (checksums)
- [ ] Confirm backups uploaded to cloud storage
- [ ] Review backup logs for errors or warnings
- [ ] Verify backup retention policies applied

#### Procedures:

1. **Check Backup Logs**
   ```bash
   # Check database backup log
   tail -50 /var/log/backup/db_backup.log

   # Check file system backup log
   tail -50 /var/log/backup/files_backup.log

   # Check cloud sync log
   tail -50 /var/log/backup/cloud_sync.log
   ```

2. **Verify Backup Files**
   ```bash
   # Check local backup directory
   ls -la /opt/backups/database/
   ls -la /opt/backups/files/

   # Verify file sizes (should be > 0 and reasonable)
   du -sh /opt/backups/database/* | tail -5
   du -sh /opt/backups/files/* | tail -5
   ```

3. **Test Backup Integrity**
   ```bash
   # Test database backup
   pg_restore --list /opt/backups/database/latest.sql.gz > /dev/null

   # Test file backup
   tar -tzf /opt/backups/files/latest.tar.gz > /dev/null
   ```

4. **Verify Cloud Storage**
   ```bash
   # Check AWS S3 backup bucket
   aws s3 ls s3://trixtech-backups/database/ --recursive | tail -5
   aws s3 ls s3://trixtech-backups/files/ --recursive | tail -5

   # Verify backup file exists in cloud
   aws s3api head-object --bucket trixtech-backups --key database/latest.sql.gz
   ```

### Automated Verification Script

```bash
#!/bin/bash
# Daily backup verification script
# File: /opt/backup-scripts/daily_verify.sh

set -e

LOG_FILE="/var/log/backup/daily_verification.log"
THRESHOLD_HOURS=25  # Alert if backup older than 25 hours

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting daily backup verification"

# Check database backups
LATEST_DB=$(find /opt/backups/database -name "*.sql.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -z "$LATEST_DB" ]; then
    log "ERROR: No database backups found!"
    exit 1
fi

DB_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_DB")) / 3600 ))
if [ $DB_AGE_HOURS -gt $THRESHOLD_HOURS ]; then
    log "WARNING: Latest database backup is $DB_AGE_HOURS hours old"
fi

# Check file backups
LATEST_FILES=$(find /opt/backups/files -name "*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
if [ -n "$LATEST_FILES" ]; then
    FILES_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_FILES")) / 3600 ))
    if [ $FILES_AGE_HOURS -gt $THRESHOLD_HOURS ]; then
        log "WARNING: Latest file backup is $FILES_AGE_HOURS hours old"
    fi
fi

# Verify cloud sync
if ! aws s3 ls "s3://trixtech-backups/database/$(basename "$LATEST_DB")" > /dev/null 2>&1; then
    log "ERROR: Database backup not found in cloud storage"
    exit 1
fi

log "Daily backup verification completed successfully"
```

## Weekly Backup Maintenance

### Sunday Backup System Review (10:00 AM UTC)

**Objective:** Comprehensive backup system maintenance and optimization

**Duration:** 1 hour

**Responsible:** DevOps engineer

#### Maintenance Tasks:
- [ ] Review backup performance and duration trends
- [ ] Analyze backup failure patterns
- [ ] Optimize backup schedules if needed
- [ ] Review and update backup scripts
- [ ] Check backup storage costs and usage
- [ ] Verify backup encryption settings
- [ ] Update backup documentation

#### Procedures:

1. **Performance Analysis**
   ```bash
   # Analyze backup duration trends
   grep "backup completed" /var/log/backup/db_backup.log | tail -10

   # Check backup sizes over time
   ls -la /opt/backups/database/ | awk '{print $5, $9}' | tail -10
   ```

2. **Storage Optimization**
   ```bash
   # Check cloud storage usage
   aws s3 ls s3://trixtech-backups/ --recursive --summarize

   # Identify large backup files
   aws s3api list-objects-v2 --bucket trixtech-backups --query 'sort_by(Contents, &Size)[-5:]'

   # Review storage costs
   aws ce get-cost-and-usage \
     --time-period Start=2024-01-01,End=2024-12-31 \
     --granularity MONTHLY \
     --metrics BlendedCost \
     --group-by Type=DIMENSION,Key=SERVICE \
     --filter '{"Dimensions": {"Key": "SERVICE", "Values": ["Amazon Simple Storage Service"]}}'
   ```

3. **Backup Script Updates**
   ```bash
   # Check for script updates in repository
   git fetch origin
   git log --oneline origin/main -- /opt/backup-scripts/

   # Update scripts if needed
   git pull origin main
   chmod +x /opt/backup-scripts/*.sh
   ```

## Monthly Backup Testing

### First Monday Backup Restoration Test (9:00 AM UTC)

**Objective:** Test backup restoration capabilities

**Duration:** 2 hours

**Responsible:** DevOps engineer

#### Testing Checklist:
- [ ] Select appropriate test environment
- [ ] Prepare test database instance
- [ ] Restore database backup
- [ ] Verify data integrity
- [ ] Test application functionality
- [ ] Restore file system backups
- [ ] Document test results
- [ ] Clean up test environment

#### Database Restoration Test:

1. **Prepare Test Environment**
   ```bash
   # Create test database instance
   kubectl run test-postgres --image=postgres:13 --env="POSTGRES_PASSWORD=testpass" --port=5432

   # Wait for database to be ready
   kubectl wait --for=condition=ready pod/test-postgres
   ```

2. **Restore Database Backup**
   ```bash
   # Copy backup to test pod
   kubectl cp /opt/backups/database/latest.sql.gz test-postgres:/tmp/

   # Restore database
   kubectl exec test-postgres -- bash -c "
     gunzip /tmp/latest.sql.gz
     psql -U postgres -f /tmp/latest.sql
   "
   ```

3. **Verify Data Integrity**
   ```bash
   # Check record counts
   kubectl exec test-postgres -- psql -U postgres -c "
     SELECT schemaname, tablename, n_tup_ins - n_tup_del as row_count
     FROM pg_stat_user_tables
     ORDER BY row_count DESC;
   "

   # Verify key tables have data
   kubectl exec test-postgres -- psql -U postgres -c "
     SELECT COUNT(*) FROM users;
     SELECT COUNT(*) FROM bookings;
     SELECT COUNT(*) FROM services;
   "
   ```

4. **Test Application Functionality**
   ```bash
   # Start test application instance
   kubectl run test-backend --image=trixtech/backend:test --env="DATABASE_URL=postgresql://postgres:testpass@test-postgres:5432/trixtech"

   # Test API endpoints
   kubectl exec test-backend -- curl http://localhost:3000/health
   kubectl exec test-backend -- curl http://localhost:3000/api/bookings
   ```

5. **File System Restoration Test**
   ```bash
   # Create test file system
   kubectl run test-files --image=busybox -- sleep 3600

   # Restore files
   kubectl cp /opt/backups/files/latest.tar.gz test-files:/tmp/
   kubectl exec test-files -- tar -xzf /tmp/latest.tar.gz -C /tmp/

   # Verify file integrity
   kubectl exec test-files -- find /tmp -type f -exec md5sum {} \; | wc -l
   ```

6. **Cleanup Test Environment**
   ```bash
   # Remove test resources
   kubectl delete pod test-postgres test-backend test-files
   ```

## Quarterly Backup Audits

### End of Quarter Backup Audit (Last Friday, 9:00 AM UTC)

**Objective:** Comprehensive backup system audit and compliance review

**Duration:** 4 hours

**Responsible:** DevOps lead

#### Audit Checklist:
- [ ] Review backup coverage (all critical systems included)
- [ ] Verify retention policies compliance
- [ ] Assess backup security (encryption, access controls)
- [ ] Review disaster recovery capabilities
- [ ] Check compliance with regulatory requirements
- [ ] Evaluate backup system performance
- [ ] Update backup policies and procedures

#### Audit Procedures:

1. **Coverage Assessment**
   ```bash
   # List all databases and verify backups exist
   kubectl get pods -l app=postgres -o name | while read pod; do
     db_name=$(kubectl exec $pod -- psql -U postgres -c "SELECT current_database();" -t)
     echo "Database: $db_name"
     ls -la /opt/backups/database/ | grep "$db_name"
   done

   # Check application configurations backed up
   find /opt/backups/files -name "*.tar.gz" -exec tar -tzf {} \; | grep -E "(config|env)" | head -10
   ```

2. **Retention Policy Verification**
   ```bash
   # Check backup age distribution
   find /opt/backups/database -name "*.sql.gz" -printf '%T@ %p\n' | sort -n | awk '
     BEGIN { print "Backup Age Analysis:" }
     {
       age_days = (systime() - $1) / 86400
       if (age_days <= 1) daily++
       else if (age_days <= 7) weekly++
       else if (age_days <= 30) monthly++
       else if (age_days <= 365) yearly++
       else old++
     }
     END {
       print "Daily backups:", daily
       print "Weekly backups:", weekly
       print "Monthly backups:", monthly
       print "Yearly backups:", yearly
       print "Old backups:", old
     }
   '
   ```

3. **Security Assessment**
   ```bash
   # Verify backup encryption
   file /opt/backups/database/latest.sql.gz

   # Check cloud storage encryption
   aws s3api get-bucket-encryption --bucket trixtech-backups

   # Review access permissions
   aws s3api get-bucket-policy --bucket trixtech-backups
   ```

## Backup Restoration Procedures

### Emergency Database Restoration

**Trigger:** Database corruption, accidental data deletion, or system failure

**Duration:** 2-4 hours depending on data size

**Responsible:** DBA/DevOps engineer

#### Step-by-Step Procedure:

1. **Assess the Situation**
   ```bash
   # Check current database status
   kubectl exec postgres-0 -- psql -U postgres -c "SELECT version();"
   kubectl exec postgres-0 -- psql -U postgres -c "SELECT * FROM pg_stat_activity;"

   # Identify affected data/tables
   kubectl logs deployment/trixtech-backend | grep -i error | tail -20
   ```

2. **Select Appropriate Backup**
   ```bash
   # List available backups
   ls -la /opt/backups/database/ | tail -10

   # Choose most recent backup before incident
   # If point-in-time recovery needed, identify timestamp
   SELECT * FROM bookings WHERE created_at >= '2024-01-01 10:00:00';
   ```

3. **Prepare Restoration Environment**
   ```bash
   # Scale down application
   kubectl scale deployment trixtech-backend --replicas=0
   kubectl scale deployment trixtech-frontend --replicas=0

   # Create restoration database
   kubectl run restore-postgres --image=postgres:13 --env="POSTGRES_PASSWORD=restpass"
   ```

4. **Perform Restoration**
   ```bash
   # Copy backup to restoration pod
   kubectl cp /opt/backups/database/selected_backup.sql.gz restore-postgres:/tmp/

   # Restore database
   kubectl exec restore-postgres -- bash -c "
     gunzip /tmp/selected_backup.sql.gz
     psql -U postgres -f /tmp/selected_backup.sql
   "

   # Verify restoration
   kubectl exec restore-postgres -- psql -U postgres -c "
     SELECT COUNT(*) FROM users;
     SELECT COUNT(*) FROM bookings;
   "
   ```

5. **Switch to Restored Database**
   ```bash
   # Update application configuration
   kubectl set env deployment/trixtech-backend DATABASE_URL=postgresql://postgres:restpass@restore-postgres:5432/trixtech

   # Scale up application
   kubectl scale deployment trixtech-backend --replicas=3
   kubectl scale deployment trixtech-frontend --replicas=2
   ```

6. **Verify Application Functionality**
   ```bash
   # Test critical functionality
   curl -f https://api.trixtech.com/health
   curl -f https://api.trixtech.com/api/bookings

   # Monitor for errors
   kubectl logs deployment/trixtech-backend --follow --tail=10
   ```

### File System Restoration

**Trigger:** File corruption, accidental deletion, or configuration loss

1. **Identify Missing/Changed Files**
   ```bash
   # Compare current state with backup
   tar -tzf /opt/backups/files/latest.tar.gz | head -20
   find /opt/trixtech -type f | head -20
   ```

2. **Selective File Restoration**
   ```bash
   # Extract specific files
   tar -xzf /opt/backups/files/latest.tar.gz -C /tmp/restore opt/trixtech/config/

   # Restore configuration files
   cp -r /tmp/restore/opt/trixtech/config/* /opt/trixtech/config/
   ```

3. **Complete System Restoration**
   ```bash
   # Full restoration (use with caution)
   tar -xzf /opt/backups/files/latest.tar.gz -C /
   ```

## Backup Cleanup Procedures

### Automated Cleanup

```bash
#!/bin/bash
# Backup cleanup script
# File: /opt/backup-scripts/cleanup.sh

set -e

LOG_FILE="/var/log/backup/cleanup.log"

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") - $1" | tee -a "$LOG_FILE"
}

log "Starting backup cleanup"

# Database backup cleanup (keep last 30 daily, 12 weekly, 12 monthly)
find /opt/backups/database -name "*.sql.gz" -type f -mtime +30 -delete

# File backup cleanup (keep last 30 daily, 12 weekly)
find /opt/backups/files -name "*.tar.gz" -type f -mtime +30 -delete

# Kubernetes backup cleanup (keep last 12 weekly)
find /opt/backups/kubernetes -name "*.tar.gz" -type f -mtime +84 -delete

# Cloud storage cleanup
aws s3api list-objects-v2 --bucket trixtech-backups --prefix database/ --query 'Contents[?LastModified<`2023-01-01`].Key' | jq -r '.[]' | while read key; do
  aws s3 rm "s3://trixtech-backups/$key"
done

log "Backup cleanup completed"
```

### Manual Cleanup Procedures

**When to Perform Manual Cleanup:**
- Storage space running low
- Retention policy changes
- Compliance requirements
- Cost optimization

**Manual Cleanup Steps:**
1. Review current backup inventory
2. Identify backups eligible for deletion
3. Verify no legal holds or compliance requirements
4. Delete from local storage
5. Delete from cloud storage
6. Update backup inventory
7. Verify cleanup success

## Backup Monitoring and Alerting

### Backup Health Metrics

```yaml
# Prometheus metrics for backup monitoring
groups:
- name: backup_monitoring
  rules:
  - record: backup_success_rate
    expr: rate(backup_status{status="success"}[7d]) / rate(backup_status[7d])

  - record: backup_age_hours
    expr: (time() - backup_last_success_timestamp) / 3600

  - record: backup_storage_used_gb
    expr: backup_storage_bytes / 1024 / 1024 / 1024
```

### Backup Alerts

```yaml
groups:
- name: backup_alerts
  rules:
  - alert: BackupFailed
    expr: backup_status{status="failed"} == 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Backup job failed"
      description: "Backup job {{ $labels.job }} failed to complete"

  - alert: BackupTooOld
    expr: backup_age_hours > 25
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Backup is too old"
      description: "Latest backup is {{ $value }} hours old"

  - alert: BackupStorageFull
    expr: backup_storage_used_gb / backup_storage_total_gb > 0.9
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Backup storage running low"
      description: "Backup storage is {{ $value }}% full"
```

## Disaster Recovery Testing

### Annual Disaster Recovery Test

**Objective:** Full disaster recovery simulation

**Duration:** 8 hours

**Responsible:** Full engineering team

#### Test Scenarios:
- Complete data center failure
- Ransomware attack simulation
- Database corruption
- Application deployment failure

#### Test Procedure:

1. **Planning Phase (2 weeks prior)**
   - Define test scope and objectives
   - Prepare test environment
   - Notify stakeholders and prepare communications
   - Assemble recovery team

2. **Execution Phase**
   - Simulate disaster scenario
   - Execute recovery procedures
   - Verify system functionality
   - Measure recovery time and data loss

3. **Evaluation Phase**
   - Assess test results against RTO/RPO
   - Identify gaps and improvements
   - Update procedures and documentation
   - Report findings to stakeholders

## Troubleshooting

### Common Backup Issues

#### Backup Job Failures

**Symptoms:** Backup jobs failing with errors

**Solutions:**
1. Check backup script permissions
2. Verify database connectivity
3. Review disk space availability
4. Check log files for specific errors
5. Test backup commands manually

#### Slow Backup Performance

**Symptoms:** Backups taking longer than expected

**Solutions:**
1. Optimize backup queries
2. Check network bandwidth
3. Review compression settings
4. Consider incremental backups
5. Schedule during low-usage periods

#### Storage Access Issues

**Symptoms:** Cannot upload to cloud storage

**Solutions:**
1. Verify credentials and permissions
2. Check network connectivity
3. Review storage quotas and limits
4. Test manual upload commands

#### Backup Corruption

**Symptoms:** Backup integrity checks failing

**Solutions:**
1. Test backup restoration manually
2. Check available memory during backup
3. Verify network stability
4. Implement checksum validation

### Recovery Testing Issues

**Symptoms:** Restoration procedures failing

**Solutions:**
1. Verify backup file integrity
2. Check target environment compatibility
3. Review restoration commands
4. Test in isolated environment first

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Backup Setup](../setup/BACKUP_SETUP.md)
- [Routine Maintenance](../maintenance/ROUTINE_MAINTENANCE.md)
- [Backup Troubleshooting](../troubleshooting/BACKUP_TROUBLESHOOTING.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review backup procedures quarterly. Update retention policies annually. Test restoration procedures biannually. Audit backup systems annually.