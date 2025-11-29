# Security Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Security Scanner Issues](#security-scanner-issues)
3. [False Positive Management](#false-positive-management)
4. [Vulnerability Assessment Problems](#vulnerability-assessment-problems)
5. [Access Control Issues](#access-control-issues)
6. [Compliance Scanning Problems](#compliance-scanning-problems)
7. [Security Monitoring Failures](#security-monitoring-failures)
8. [Incident Response Issues](#incident-response-issues)
9. [Security Tool Integration Problems](#security-tool-integration-problems)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for security system issues in the TRIXTECH Booking System. It covers scanner problems, false positives, compliance issues, and security monitoring failures with step-by-step resolution procedures.

## Security Scanner Issues

### Scanner Execution Failures

**Symptoms:** Security scans failing to run or complete

**Common Causes:**
1. Scanner tool not installed or accessible
2. Insufficient permissions
3. Resource constraints
4. Configuration errors

**Solutions:**

1. **Check Scanner Installation**
   ```bash
   # Verify Trivy installation
   trivy --version

   # Check scanner availability
   which trivy || echo "Trivy not found"

   # Test scanner functionality
   trivy image --help
   ```

2. **Verify Permissions**
   ```bash
   # Check execution permissions
   ls -la /usr/local/bin/trivy

   # Test scanner with proper user
   sudo -u scanner trivy --version

   # Check Docker access for container scanning
   docker ps
   ```

3. **Resource Availability**
   ```bash
   # Check available resources
   free -h
   df -h

   # Monitor resource usage during scan
   trivy image nginx:latest &
   top -p $!
   ```

4. **Configuration Validation**
   ```bash
   # Validate scan configuration
   cat .trivy.yml

   # Test configuration
   trivy config --help
   ```

### Scan Result Parsing Issues

**Symptoms:** Scans complete but results cannot be processed

**Common Causes:**
1. Output format issues
2. Parser configuration errors
3. File encoding problems
4. Result size limits

**Solutions:**

1. **Check Output Format**
   ```bash
   # Test different output formats
   trivy image nginx:latest --format json
   trivy image nginx:latest --format sarif

   # Validate JSON output
   trivy image nginx:latest --format json | jq '.Results[0].Vulnerabilities[0]'
   ```

2. **Debug Parser Issues**
   ```bash
   # Check parser logs
   trivy image nginx:latest --debug

   # Test with minimal configuration
   trivy image nginx:latest --format table
   ```

3. **Handle Large Results**
   ```bash
   # Split large scans
   trivy filesystem /app --format json --output results-part1.json --skip-files "/node_modules/**"
   trivy filesystem /app --format json --output results-part2.json --skip-files "!/node_modules/**"

   # Compress results
   trivy image nginx:latest --format json | gzip > results.json.gz
   ```

### Scanner Performance Issues

**Symptoms:** Security scans taking too long or using excessive resources

**Common Causes:**
1. Large scan targets
2. Network timeouts
3. Inefficient scanning strategies
4. Resource limitations

**Solutions:**

1. **Optimize Scan Scope**
   ```bash
   # Limit scan depth
   trivy filesystem /app --skip-files "/test/**,/tmp/**"

   # Use specific file types
   trivy filesystem /app --skip-files "!*.jar,*.war,*.ear"
   ```

2. **Parallel Scanning**
   ```bash
   # Scan multiple targets in parallel
   parallel -j 4 'trivy image {} --format json --output results-{}.json' ::: nginx:latest redis:alpine postgres:13
   ```

3. **Caching and Incremental Scans**
   ```bash
   # Use cache for repeated scans
   trivy image nginx:latest --cache-dir /tmp/trivy-cache

   # Skip unchanged files
   trivy filesystem /app --skip-update
   ```

## False Positive Management

### Identifying False Positives

**Symptoms:** Security alerts for non-existent vulnerabilities

**Common Causes:**
1. Outdated vulnerability databases
2. Incorrect asset identification
3. Environmental factors
4. Scanner misconfigurations

**Solutions:**

1. **Verify Vulnerability Data**
   ```bash
   # Check vulnerability database age
   trivy --version
   trivy image nginx:latest --debug | grep "vulnerability-db"

   # Update vulnerability database
   trivy image --download-db-only
   ```

2. **Validate Asset Context**
   ```bash
   # Check if vulnerability applies to environment
   trivy image nginx:latest --format json | jq '.Results[0].Vulnerabilities[] | select(.VulnerabilityID == "CVE-XXXX-XXXX") | .Title'

   # Verify package versions
   docker run nginx:latest dpkg -l | grep nginx
   ```

3. **Environmental Factors**
   ```bash
   # Check if vulnerability is mitigated
   # Example: Check if package is not actually used
   trivy filesystem /app --format json | jq '.Results[0].Vulnerabilities[] | select(.PkgName == "unused-package")'
   ```

### Managing False Positives

**Strategies for handling false positives:**

1. **Suppression Rules**
   ```yaml
   # Trivy ignore file
   # .trivyignore
   CVE-2021-44228 # Log4j vulnerability not applicable
   CVE-2020-12345 # False positive in test environment

   # Package-specific ignores
   ignore:
     - vulnerability: CVE-2021-44228
       package: log4j-core
   ```

2. **Risk Acceptance**
   ```bash
   # Document accepted risks
   cat > risk_acceptance.md << EOF
   # Accepted Security Risks

   ## CVE-2021-44228 (Log4j)
   - Risk Level: Low
   - Reason: Not using affected log4j features
   - Mitigation: Monitoring for exploitation attempts
   - Review Date: 2024-12-31
   EOF
   ```

3. **Automated Filtering**
   ```bash
   # Filter out known false positives
   trivy image nginx:latest --format json | \
     jq '.Results[0].Vulnerabilities[] | select(.VulnerabilityID != "CVE-2021-44228")'
   ```

## Vulnerability Assessment Problems

### Incomplete Vulnerability Data

**Symptoms:** Missing vulnerabilities or incomplete assessment

**Common Causes:**
1. Scanner limitations
2. Unsupported file types
3. Network restrictions
4. Database connectivity issues

**Solutions:**

1. **Multiple Scanner Approach**
   ```bash
   # Use complementary scanners
   trivy image myapp:latest --format json > trivy-results.json
   grype myapp:latest --output json > grype-results.json

   # Combine results
   jq -s '.[0].Results[0].Vulnerabilities + .[1].matches' trivy-results.json grype-results.json
   ```

2. **Manual Vulnerability Checks**
   ```bash
   # Check specific components
   docker run myapp:latest ldd /usr/local/bin/app | grep -i ssl

   # Verify library versions
   docker run myapp:latest dpkg -l | grep openssl
   ```

3. **Offline Scanning**
   ```bash
   # Download vulnerability databases
   trivy image --download-db-only

   # Scan offline
   trivy image myapp:latest --offline-scan
   ```

### Vulnerability Prioritization Issues

**Symptoms:** Important vulnerabilities not being highlighted

**Common Causes:**
1. Incorrect severity scoring
2. Missing context information
3. Scoring algorithm issues

**Solutions:**

1. **Custom Risk Scoring**
   ```bash
   # Implement custom scoring logic
   trivy image myapp:latest --format json | \
     jq '.Results[0].Vulnerabilities[] | {
       id: .VulnerabilityID,
       severity: .Severity,
       cvss: .CVSS,
       custom_risk: (
         if .Severity == "CRITICAL" then 10
         elif .Severity == "HIGH" then 7
         elif .Severity == "MEDIUM" then 4
         else 1 end
       )
     }' | sort_by(.custom_risk) | reverse
   ```

2. **Context-Aware Assessment**
   ```bash
   # Consider exploitability
   # Check if vulnerability is in network-exposed components
   trivy image myapp:latest --format json | \
     jq '.Results[0].Vulnerabilities[] | select(.PkgName | contains("network"))'
   ```

## Access Control Issues

### Authentication Failures

**Symptoms:** Users unable to authenticate or access systems

**Common Causes:**
1. LDAP/AD configuration issues
2. Certificate problems
3. Token expiration
4. Account lockouts

**Solutions:**

1. **LDAP Troubleshooting**
   ```bash
   # Test LDAP connectivity
   ldapsearch -x -H ldap://ldap.example.com -b "dc=example,dc=com" "(uid=testuser)"

   # Check LDAP configuration
   cat /etc/ldap/ldap.conf
   ```

2. **Certificate Validation**
   ```bash
   # Verify certificates
   openssl x509 -in /etc/ssl/certs/ldap.crt -text -noout

   # Test certificate chain
   openssl s_client -connect ldap.example.com:636 -CAfile /etc/ssl/certs/ca.crt
   ```

3. **Token Management**
   ```bash
   # Check token expiration
   curl -H "Authorization: Bearer $TOKEN" https://auth.example.com/introspect

   # Refresh tokens
   curl -X POST https://auth.example.com/token \
     -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN"
   ```

### Authorization Problems

**Symptoms:** Users authenticated but lacking proper permissions

**Common Causes:**
1. RBAC misconfigurations
2. Group membership issues
3. Policy conflicts
4. Role assignment errors

**Solutions:**

1. **RBAC Verification**
   ```bash
   # Check role bindings
   kubectl get rolebindings -o wide

   # Verify user roles
   kubectl auth can-i list pods --as testuser

   # Check cluster roles
   kubectl get clusterrolebindings | grep testuser
   ```

2. **Group Membership**
   ```bash
   # Check user groups
   id testuser

   # Verify group permissions
   kubectl get rolebinding -o json | jq '.items[] | select(.subjects[]?.name == "testuser")'
   ```

3. **Policy Debugging**
   ```bash
   # Test policies
   kubectl auth can-i create pods --as testuser --namespace default

   # Check policy violations
   kubectl get events --field-selector reason=FailedSync
   ```

## Compliance Scanning Problems

### Compliance Check Failures

**Symptoms:** Compliance scans failing or producing incorrect results

**Common Causes:**
1. Outdated compliance frameworks
2. Configuration drift
3. Tool compatibility issues
4. Missing data sources

**Solutions:**

1. **Framework Updates**
   ```bash
   # Update compliance frameworks
   kube-bench --version
   # Download latest version if needed

   # Update CIS benchmarks
   curl -L https://github.com/aquasecurity/kube-bench/releases/latest/download/kube-bench.tar.gz | tar -xz
   ```

2. **Configuration Validation**
   ```bash
   # Check configuration files
   kube-bench run --config-dir /etc/kube-bench/cfg

   # Validate YAML syntax
   yamllint /etc/kube-bench/cfg/config.yaml
   ```

3. **Data Source Issues**
   ```bash
   # Check API server access
   kubectl cluster-info

   # Verify permissions
   kubectl auth can-i get nodes --as kube-bench
   ```

### Compliance Reporting Issues

**Symptoms:** Compliance reports not generating or incomplete

**Common Causes:**
1. Report format issues
2. Data collection failures
3. Template problems
4. Storage issues

**Solutions:**

1. **Report Generation**
   ```bash
   # Generate different report formats
   kube-bench run --output json
   kube-bench run --output junit

   # Check report content
   kube-bench run --output json | jq '.Controls[0].tests[0]'
   ```

2. **Data Collection Debugging**
   ```bash
   # Enable verbose logging
   kube-bench run --log-level debug

   # Check individual checks
   kube-bench run --check 1.1.1
   ```

3. **Template Issues**
   ```bash
   # Validate report templates
   cat /etc/kube-bench/templates/report.html | grep -i error

   # Test template rendering
   kube-bench run --template /etc/kube-bench/templates/custom.tpl
   ```

## Security Monitoring Failures

### Falco Rule Issues

**Symptoms:** Falco not detecting expected security events

**Common Causes:**
1. Rule syntax errors
2. Event source problems
3. Filter misconfigurations
4. Kernel module issues

**Solutions:**

1. **Rule Validation**
   ```bash
   # Test rule syntax
   falco --validate /etc/falco/falco_rules.yaml

   # Check rule loading
   falco --list | grep "Loaded rules"
   ```

2. **Event Source Testing**
   ```bash
   # Test event capture
   falco --test /etc/falco/falco_rules.yaml

   # Check kernel module
   lsmod | grep falco
   ```

3. **Filter Debugging**
   ```yaml
   # Debug rule filters
   - rule: Debug Rule
     desc: Debug security events
     condition: evt.type = execve
     output: "Command executed: %proc.cmdline"
     priority: DEBUG
   ```

### SIEM Integration Problems

**Symptoms:** Security events not reaching SIEM system

**Common Causes:**
1. Network connectivity issues
2. Authentication failures
3. Data format problems
4. Rate limiting

**Solutions:**

1. **Connectivity Testing**
   ```bash
   # Test SIEM connectivity
   curl -X POST https://siem.example.com/api/events \
     -H "Authorization: Bearer $SIEM_TOKEN" \
     -d '{"test": "event"}'

   # Check network path
   traceroute siem.example.com
   ```

2. **Authentication Issues**
   ```bash
   # Verify credentials
   curl -H "Authorization: Bearer $SIEM_TOKEN" https://siem.example.com/api/status

   # Check token expiration
   jwt decode $SIEM_TOKEN
   ```

3. **Data Format Validation**
   ```bash
   # Validate event format
   cat security_event.json | jq .

   # Test event submission
   curl -X POST https://siem.example.com/api/events \
     -H "Content-Type: application/json" \
     -d @security_event.json
   ```

## Incident Response Issues

### Automated Response Failures

**Symptoms:** Security incidents not triggering automated responses

**Common Causes:**
1. Playbook syntax errors
2. Integration failures
3. Permission issues
4. Logic errors

**Solutions:**

1. **Playbook Validation**
   ```yaml
   # Validate playbook syntax
   yamllint incident_response.yml

   # Test playbook logic
   ansible-playbook --check incident_response.yml
   ```

2. **Integration Testing**
   ```bash
   # Test individual integrations
   curl -X POST https://slack-webhook... -d '{"text": "Test alert"}'

   # Verify API access
   curl -H "Authorization: Bearer $API_TOKEN" https://api.example.com/isolate
   ```

3. **Permission Verification**
   ```bash
   # Check automation account permissions
   kubectl auth can-i delete pods --as automation-sa

   # Test privileged operations
   sudo -u automation whoami
   ```

### Response Coordination Problems

**Symptoms:** Multiple teams responding to same incident

**Common Causes:**
1. Alert duplication
2. Communication failures
3. Process conflicts
4. Escalation issues

**Solutions:**

1. **Alert Deduplication**
   ```yaml
   # Implement alert grouping
   route:
     group_by: ['alertname', 'instance']
     group_wait: 30s
     group_interval: 5m
   ```

2. **Communication Channels**
   ```bash
   # Test notification channels
   # Email
   echo "Test alert" | mail -s "Security Alert Test" security@example.com

   # Slack
   curl -X POST https://hooks.slack.com/services/... -d '{"text": "Test alert"}'
   ```

3. **Escalation Procedures**
   ```bash
   # Define clear escalation paths
   # Level 1: On-call engineer
   # Level 2: Security team lead
   # Level 3: Executive team
   ```

## Security Tool Integration Problems

### Tool Synchronization Issues

**Symptoms:** Security tools not sharing data properly

**Common Causes:**
1. API compatibility issues
2. Data format mismatches
3. Timing problems
4. Authentication issues

**Solutions:**

1. **API Compatibility**
   ```bash
   # Check API versions
   curl -H "Authorization: Bearer $TOKEN" https://tool1.example.com/api/version
   curl -H "Authorization: Bearer $TOKEN" https://tool2.example.com/api/version

   # Test data exchange
   curl -X POST https://tool1.example.com/api/sync \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"target": "tool2", "data": {"test": "data"}}'
   ```

2. **Data Format Standardization**
   ```bash
   # Use common data formats
   # STIX for threat intelligence
   # JSON for API communication

   # Validate data formats
   cat vulnerability_data.json | jq .
   ```

3. **Synchronization Scheduling**
   ```yaml
   # Implement proper sync intervals
   apiVersion: batch/v1
   kind: CronJob
   metadata:
     name: security-tool-sync
   spec:
     schedule: "*/15 * * * *"  # Every 15 minutes
     jobTemplate:
       spec:
         containers:
         - name: sync
           image: sync-tools:latest
   ```

### Dashboard Integration Issues

**Symptoms:** Security dashboards not displaying data correctly

**Common Causes:**
1. Data source configuration errors
2. Query syntax issues
3. Permission problems
4. Visualization configuration

**Solutions:**

1. **Data Source Configuration**
   ```bash
   # Test data source connectivity
   curl "http://prometheus:9090/api/v1/query?query=up"

   # Check Grafana data source
   curl -H "Authorization: Bearer $GRAFANA_TOKEN" http://grafana/api/datasources | jq '.[0].status'
   ```

2. **Query Debugging**
   ```bash
   # Test queries in Prometheus
   curl "http://prometheus:9090/api/v1/query?query=security_events_total"

   # Check query syntax
   promtool check query "security_events_total"
   ```

3. **Permission Issues**
   ```bash
   # Check dashboard permissions
   curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
     http://grafana/api/dashboards/uid/security-dashboard/permissions

   # Verify user access
   curl -H "Authorization: Bearer $GRAFANA_TOKEN" \
     http://grafana/api/user
   ```

### Automated Remediation Issues

**Symptoms:** Security fixes not applying automatically

**Common Causes:**
1. Remediation script failures
2. Dependency conflicts
3. Environment differences
4. Approval workflow issues

**Solutions:**

1. **Script Testing**
   ```bash
   # Test remediation scripts
   bash remediation_script.sh --dry-run

   # Check script permissions
   ls -la remediation_script.sh
   ```

2. **Dependency Management**
   ```bash
   # Check for conflicts
   apt-cache policy package-name

   # Test package installation
   apt-get install --dry-run package-name
   ```

3. **Environment Validation**
   ```bash
   # Verify environment compatibility
   uname -a
   cat /etc/os-release

   # Check available resources
   free -h
   df -h
   ```

## Related Documentation

- [Security Setup](../setup/SECURITY_SETUP.md)
- [Security Maintenance](../maintenance/SECURITY_MAINTENANCE.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review security scanner configurations monthly. Update vulnerability databases weekly. Test incident response procedures quarterly. Audit security tool integrations annually.