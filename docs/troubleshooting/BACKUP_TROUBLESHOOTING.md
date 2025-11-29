# Backup Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Backup Failure Diagnosis](#backup-failure-diagnosis)
3. [Database Backup Issues](#database-backup-issues)
4. [File System Backup Issues](#file-system-backup-issues)
5. [Storage and Transfer Issues](#storage-and-transfer-issues)
6. [Backup Verification Problems](#backup-verification-problems)
7. [Data Recovery Issues](#data-recovery-issues)
8. [Emergency Recovery Procedures](#emergency-recovery-procedures)
9. [Prevention and Monitoring](#prevention-and-monitoring)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for backup system issues in the TRIXTECH Booking System. It covers diagnosis and resolution of backup failures, data recovery problems, and preventive measures to ensure reliable backup operations.

## Backup Failure Diagnosis

### Initial Assessment

**When backups fail:**

1. **Check Backup Status**
   ```bash
   # Check recent backup logs
   tail -50 /var/log/backup/db_backup.log
   tail -50 /var/log/backup/files_backup.log

   # Check backup file existence
   ls -la /opt/backups/database/
   ls -la /opt/backups/files/
   ```

2. **Identify Failure Type**
   ```bash
   # Check for specific error patterns
   grep -i "error\|fail\|exception" /var/log/backup/*.log | tail -10

   # Check system resources during backup
   grep "Starting backup" /var/log/backup/db_backup.log -A 5 -B 5
   ```

3. **Assess Impact**
   - How long since last successful backup?
   - What data is at risk?
   - Are there multiple backup methods affected?
   - Is this a systemic issue or isolated failure?

### Diagnostic Checklist

- [ ] Backup scripts are executable
- [ ] Required permissions are set
- [ ] Database connectivity works
- [ ] Storage space is available
- [ ] Network connectivity to cloud storage
- [ ] Required tools are installed
- [ ] System resources are sufficient
- [ ] Previous backups are intact

## Database Backup Issues

### Connection Failures

**Symptoms:** pg_dump fails with connection errors

**Common Causes:**
1. Database server down
2. Authentication credentials expired
3. Network connectivity issues
4. Connection limits exceeded

**Solutions:**

1. **Check Database Status**
   ```bash
   # Test database connectivity
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();"

   # Check if database is accepting connections
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT * FROM pg_stat_activity LIMIT 5;"
   ```

2. **Verify Credentials**
   ```bash
   # Test authentication
   PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1;"

   # Check password expiry
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT expiry FROM pg_user WHERE usename = '$DB_USER';"
   ```

3. **Network Issues**
   ```bash
   # Test network connectivity
   nc -zv $DB_HOST $DB_PORT

   # Check firewall rules
   iptables -L | grep $DB_PORT

   # Test from backup server
   telnet $DB_HOST $DB_PORT
   ```

4. **Connection Pool Issues**
   ```bash
   # Check connection limits
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SHOW max_connections;"

   # Check active connections
   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
   ```

### Permission Issues

**Symptoms:** Access denied errors during backup

**Common Causes:**
1. Insufficient database privileges
2. File system permission issues
3. SELinux/AppArmor restrictions
4. Backup user account issues

**Solutions:**

1. **Database Permissions**
   ```sql
   -- Grant necessary permissions to backup user
   GRANT CONNECT ON DATABASE trixtech TO backup_user;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO backup_user;
   GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO backup_user;

   -- For PostgreSQL 15+
   GRANT pg_read_all_data TO backup_user;
   ```

2. **File System Permissions**
   ```bash
   # Check backup directory permissions
   ls -ld /opt/backups/
   ls -ld /opt/backups/database/

   # Fix permissions
   chown backup:backup /opt/backups/
   chmod 755 /opt/backups/
   chmod 700 /opt/backups/database/
   ```

3. **SELinux Issues**
   ```bash
   # Check SELinux status
   sestatus

   # Check for denials
   ausearch -m avc -ts recent | grep backup

   # Add SELinux policy if needed
   semanage fcontext -a -t postgresql_db_t "/opt/backups/database(/.*)?"
   restorecon -Rv /opt/backups/database/
   ```

### Resource Constraints

**Symptoms:** Backup fails due to insufficient resources

**Common Causes:**
1. Disk space full
2. Memory exhaustion
3. CPU overload
4. I/O bottlenecks

**Solutions:**

1. **Disk Space Issues**
   ```bash
   # Check available space
   df -h /opt/backups/

   # Check backup size vs available space
   du -sh /opt/backups/database/
   du -sh /opt/backups/files/

   # Clean old backups if needed
   find /opt/backups/ -name "*.gz" -mtime +30 -delete
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage during backup
   free -h

   # Monitor memory during backup
   watch -n 5 'free -h && ps aux | grep pg_dump | grep -v grep'

   # Adjust PostgreSQL work_mem for backup
   psql -c "ALTER USER backup_user SET work_mem = '64MB';"
   ```

3. **I/O Performance**
   ```bash
   # Check I/O statistics
   iostat -x 1 5

   # Monitor I/O during backup
   iotop -o -b -n 10 | grep pg_dump

   # Adjust I/O priority
   ionice -c 3 -p $(pgrep pg_dump)
   ```

## File System Backup Issues

### Rsync Failures

**Symptoms:** rsync exits with errors

**Common Causes:**
1. Source/destination path issues
2. Permission mismatches
3. File locks or access issues
4. Network interruptions

**Solutions:**

1. **Path Verification**
   ```bash
   # Check source and destination paths
   ls -ld /opt/trixtech/
   ls -ld /opt/backups/files/

   # Test rsync dry run
   rsync -av --dry-run /opt/trixtech/ /tmp/backup-test/
   ```

2. **Permission Issues**
   ```bash
   # Check rsync user permissions
   sudo -u backup rsync --version

   # Test file access
   sudo -u backup touch /opt/backups/files/test.txt
   sudo -u backup rm /opt/backups/files/test.txt
   ```

3. **Network Issues**
   ```bash
   # Test network connectivity for remote rsync
   rsync --version
   ssh backup@remote-server "ls -la /remote/backup/path"
   ```

### Archive Corruption

**Symptoms:** tar/gzip files corrupted

**Common Causes:**
1. Interrupted backup process
2. Disk I/O errors
3. Memory corruption
4. Compression issues

**Solutions:**

1. **Integrity Verification**
   ```bash
   # Test archive integrity
   gzip -t /opt/backups/files/latest.tar.gz

   # Test tar archive
   tar -tzf /opt/backups/files/latest.tar.gz > /dev/null

   # Check file sizes
   ls -lh /opt/backups/files/latest.tar.gz
   ```

2. **Partial Backup Recovery**
   ```bash
   # Extract what can be recovered
   tar -xzf /opt/backups/files/latest.tar.gz -C /tmp/recovery/ 2>/dev/null || true

   # Check what was recovered
   find /tmp/recovery/ -type f | wc -l

   # Compare with original
   find /opt/trixtech/ -type f | wc -l
   ```

3. **Backup Process Improvement**
   ```bash
   # Use atomic writes
   tar -czf /opt/backups/files/backup.tmp /opt/trixtech/ && mv /opt/backups/files/backup.tmp /opt/backups/files/latest.tar.gz

   # Add checksum verification
   sha256sum /opt/backups/files/latest.tar.gz > /opt/backups/files/latest.tar.gz.sha256
   ```

## Storage and Transfer Issues

### Cloud Storage Upload Failures

**Symptoms:** Backups fail to upload to cloud storage

**Common Causes:**
1. Authentication failures
2. Network connectivity issues
3. Storage quota exceeded
4. Rate limiting

**Solutions:**

1. **Authentication Issues**
   ```bash
   # Test AWS credentials
   aws sts get-caller-identity

   # Test S3 access
   aws s3 ls s3://trixtech-backups/

   # Check IAM permissions
   aws iam simulate-principal-policy --policy-source-arn arn:aws:iam::account:role/backup-role --action-names s3:PutObject
   ```

2. **Network Issues**
   ```bash
   # Test connectivity to cloud endpoints
   curl -I https://s3.amazonaws.com/

   # Check DNS resolution
   nslookup s3.amazonaws.com

   # Test upload bandwidth
   speedtest-cli
   ```

3. **Quota and Limits**
   ```bash
   # Check S3 bucket size
   aws s3 ls s3://trixtech-backups/ --recursive --summarize

   # Check account limits
   aws support describe-trusted-advisor-check-result --check-id eW7HH0l7J9
   ```

### Transfer Interruptions

**Symptoms:** Large backups fail midway through transfer

**Common Causes:**
1. Network timeouts
2. Connection instability
3. Proxy/firewall issues
4. Large file handling

**Solutions:**

1. **Timeout Configuration**
   ```bash
   # AWS CLI configuration
   aws configure set default.s3.max_concurrent_requests 10
   aws configure set default.s3.multipart_threshold 64MB
   aws configure set default.s3.multipart_chunksize 16MB

   # Test multipart upload
   aws s3 cp large_backup.sql.gz s3://trixtech-backups/database/ --expected-size $(stat -f%z large_backup.sql.gz)
   ```

2. **Resume Interrupted Transfers**
   ```bash
   # Check for partial uploads
   aws s3api list-multipart-uploads --bucket trixtech-backups

   # Resume or clean up partial uploads
   aws s3api abort-multipart-upload --bucket trixtech-backups --key database/large_backup.sql.gz --upload-id <upload-id>
   ```

3. **Alternative Transfer Methods**
   ```bash
   # Use rclone for better resumability
   rclone sync /opt/backups/ s3:trixtech-backups --progress --stats 10s --retries 3

   # Use aria2 for parallel downloads/uploads
   aria2c -x 16 -s 16 -k 1M https://example.com/large_backup.sql.gz
   ```

## Backup Verification Problems

### Verification Script Failures

**Symptoms:** Backup verification scripts fail

**Common Causes:**
1. Incorrect checksums
2. File permission issues
3. Database connection problems
4. Script logic errors

**Solutions:**

1. **Checksum Verification**
   ```bash
   # Generate and verify checksums
   sha256sum /opt/backups/database/latest.sql.gz > checksum.sha256
   sha256sum -c checksum.sha256

   # For cloud storage
   aws s3api head-object --bucket trixtech-backups --key database/latest.sql.gz --query ETag
   ```

2. **Database Verification**
   ```bash
   # Test database dump restoration
   createdb test_restore
   pg_restore -d test_restore /opt/backups/database/latest.sql.gz --no-owner --no-privileges
   psql -d test_restore -c "SELECT COUNT(*) FROM users;"

   # Clean up test database
   dropdb test_restore
   ```

3. **File System Verification**
   ```bash
   # Compare file counts
   original_count=$(find /opt/trixtech/ -type f | wc -l)
   backup_count=$(tar -tzf /opt/backups/files/latest.tar.gz | grep -v '/$' | wc -l)

   if [ "$original_count" -ne "$backup_count" ]; then
     echo "File count mismatch: $original_count vs $backup_count"
   fi
   ```

### Automated Verification Issues

**Symptoms:** Monitoring alerts for backup verification failures

**Common Causes:**
1. Verification script bugs
2. Environment differences
3. Timing issues
4. Resource constraints

**Solutions:**

1. **Script Debugging**
   ```bash
   # Run verification manually with debug output
   bash -x /opt/backup-scripts/daily_verify.sh

   # Check script exit codes
   /opt/backup-scripts/daily_verify.sh
   echo "Exit code: $?"
   ```

2. **Environment Issues**
   ```bash
   # Check environment variables
   env | grep -E "(DB_|BACKUP_)"

   # Test database connectivity in script context
   sudo -u backup /opt/backup-scripts/daily_verify.sh
   ```

## Data Recovery Issues

### Database Recovery Failures

**Symptoms:** pg_restore fails during recovery

**Common Causes:**
1. Version incompatibilities
2. Missing dependencies
3. Corruption in backup
4. Permission issues

**Solutions:**

1. **Version Compatibility**
   ```bash
   # Check PostgreSQL versions
   pg_dump --version
   pg_restore --version
   psql -c "SELECT version();"

   # Use compatible versions
   docker run --rm -v /opt/backups:/backups postgres:13 pg_restore -d ... /backups/database/latest.sql.gz
   ```

2. **Dependency Issues**
   ```sql
   -- Check for missing extensions
   SELECT * FROM pg_extension;

   -- Install required extensions before restore
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
   CREATE EXTENSION IF NOT EXISTS uuid-ossp;
   ```

3. **Partial Recovery**
   ```bash
   # Restore specific tables
   pg_restore -d trixtech --table users /opt/backups/database/latest.sql.gz
   pg_restore -d trixtech --table bookings /opt/backups/database/latest.sql.gz

   # Restore with verbose output
   pg_restore -d trixtech -v /opt/backups/database/latest.sql.gz 2>&1 | tee restore.log
   ```

### File System Recovery Issues

**Symptoms:** File extraction fails or files corrupted

**Common Causes:**
1. Archive corruption
2. Permission issues
3. Path conflicts
4. Disk space issues

**Solutions:**

1. **Archive Integrity**
   ```bash
   # Test archive before extraction
   tar -tzf /opt/backups/files/latest.tar.gz > /dev/null

   # Extract with error handling
   tar -xzf /opt/backups/files/latest.tar.gz -C /tmp/recovery/ || echo "Some files may be corrupted"
   ```

2. **Permission Handling**
   ```bash
   # Extract with correct permissions
   tar -xzf /opt/backups/files/latest.tar.gz -C /opt/trixtech/ --no-same-owner

   # Fix permissions after extraction
   chown -R trixtech:trixtech /opt/trixtech/
   find /opt/trixtech/ -type f -exec chmod 644 {} \;
   find /opt/trixtech/ -type d -exec chmod 755 {} \;
   ```

3. **Space Issues**
   ```bash
   # Check available space before extraction
   archive_size=$(du -sh /opt/backups/files/latest.tar.gz | cut -f1)
   available_space=$(df -h /opt/trixtech/ | tail -1 | awk '{print $4}')

   echo "Archive size: $archive_size, Available space: $available_space"
   ```

## Emergency Recovery Procedures

### Complete System Recovery

**Critical Situation:** Complete data center failure or major corruption

**Recovery Steps:**

1. **Assess Damage**
   ```bash
   # Check what systems are affected
   kubectl get nodes
   kubectl get pods --all-namespaces

   # Identify last known good backups
   find /opt/backups/ -name "*.gz" -printf '%T@ %p\n' | sort -n | tail -5
   ```

2. **Prepare Recovery Environment**
   ```bash
   # Set up recovery cluster if needed
   # Scale down affected services
   kubectl scale deployment --all --replicas=0 -n production

   # Prepare clean database instance
   kubectl run recovery-db --image=postgres:13 --env="POSTGRES_DB=trixtech"
   ```

3. **Execute Recovery**
   ```bash
   # Restore database
   kubectl cp /opt/backups/database/latest.sql.gz recovery-db:/tmp/
   kubectl exec recovery-db -- pg_restore -d trixtech /tmp/latest.sql.gz

   # Restore file system
   kubectl cp /opt/backups/files/latest.tar.gz recovery-files:/tmp/
   kubectl exec recovery-files -- tar -xzf /tmp/latest.tar.gz -C /opt/trixtech/
   ```

4. **Verification and Testing**
   ```bash
   # Test database integrity
   kubectl exec recovery-db -- psql -d trixtech -c "SELECT COUNT(*) FROM users;"

   # Test application functionality
   kubectl scale deployment trixtech-backend --replicas=1
   kubectl wait --for=condition=ready pod -l app=trixtech-backend

   # Run smoke tests
   curl -f http://trixtech-backend:3000/health
   ```

### Point-in-Time Recovery

**Situation:** Need to recover to specific point before data corruption

**Recovery Steps:**

1. **Identify Recovery Point**
   ```bash
   # Find backups around incident time
   find /opt/backups/database/ -name "*.sql.gz" -newermt "2024-01-01 10:00" ! -newermt "2024-01-01 12:00"

   # Check WAL archives if using continuous archiving
   ls -la /opt/backups/wal/
   ```

2. **Perform Point-in-Time Recovery**
   ```bash
   # Restore base backup
   pg_restore -d trixtech /opt/backups/database/base_backup.sql.gz

   # Apply WAL archives until target time
   pg_wal_replay --until-time="2024-01-01 11:30:00" /opt/backups/wal/
   ```

3. **Validate Recovery**
   ```sql
   -- Check data consistency
   SELECT max(created_at) FROM bookings;
   SELECT count(*) FROM users WHERE created_at > '2024-01-01 11:30:00';
   ```

## Prevention and Monitoring

### Proactive Monitoring

1. **Backup Health Monitoring**
   ```yaml
   # Prometheus alerts for backup issues
   groups:
   - name: backup_monitoring
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
       expr: (time() - backup_last_success_timestamp) / 3600 > 25
       for: 5m
       labels:
         severity: warning
       annotations:
         summary: "Backup is too old"
         description: "Latest backup is {{ $value }} hours old"
   ```

2. **Storage Monitoring**
   ```bash
   # Monitor backup storage usage
   df -h /opt/backups/
   aws s3 ls s3://trixtech-backups/ --recursive --summarize
   ```

### Regular Testing

1. **Monthly Recovery Testing**
   ```bash
   # Automated recovery testing
   /opt/backup-scripts/test_recovery.sh

   # Generate test report
   /opt/backup-scripts/generate_report.sh
   ```

2. **Quarterly Full Disaster Recovery Test**
   ```bash
   # Complete DR test procedure
   /opt/backup-scripts/dr_test.sh

   # Document results and improvements
   ```

### Backup System Improvements

1. **Redundancy**
   ```bash
   # Implement multiple backup destinations
   aws s3 cp /opt/backups/ s3://trixtech-backups-primary/
   aws s3 cp /opt/backups/ s3://trixtech-backups-secondary/

   # Use different storage classes
   aws s3 cp /opt/backups/database/ s3://trixtech-backups/ --storage-class STANDARD_IA
   ```

2. **Encryption**
   ```bash
   # Encrypt backups at rest
   gpg --encrypt --recipient backup@trixtech.com /opt/backups/database/latest.sql.gz

   # Use client-side encryption for cloud storage
   aws s3 cp encrypted_backup.sql.gz s3://trixtech-backups/ --sse AES256
   ```

## Related Documentation

- [Backup Setup](../setup/BACKUP_SETUP.md)
- [Backup Maintenance](../maintenance/BACKUP_MAINTENANCE.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review backup failures quarterly. Update troubleshooting procedures based on new failure patterns. Test recovery procedures biannually. Audit backup security annually.