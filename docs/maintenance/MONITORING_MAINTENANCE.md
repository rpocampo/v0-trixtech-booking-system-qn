# Monitoring Maintenance Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Daily Alert Management](#daily-alert-management)
3. [Weekly Monitoring Review](#weekly-monitoring-review)
4. [Monthly Alert Tuning](#monthly-alert-tuning)
5. [Quarterly Dashboard Updates](#quarterly-dashboard-updates)
6. [Alert Configuration Management](#alert-configuration-management)
7. [Monitoring System Maintenance](#monitoring-system-maintenance)
8. [Performance Baseline Updates](#performance-baseline-updates)
9. [Monitoring Documentation](#monitoring-documentation)
10. [Troubleshooting](#troubleshooting)
11. [Related Documentation](#related-documentation)

## Introduction

This guide provides procedures for maintaining and optimizing the monitoring infrastructure for the TRIXTECH Booking System. Regular monitoring maintenance ensures effective alerting, accurate dashboards, and reliable system observability.

## Daily Alert Management

### Morning Alert Review (8:30 AM UTC)

**Objective:** Review overnight alerts and system status

**Duration:** 30 minutes

**Responsible:** On-call engineer

#### Alert Review Checklist:
- [ ] Review all active alerts in Alertmanager
- [ ] Acknowledge legitimate alerts and create tickets
- [ ] Silence recurring maintenance-related alerts
- [ ] Verify alert resolution for acknowledged alerts
- [ ] Check for alert storms or flapping alerts
- [ ] Review alert escalation procedures
- [ ] Update alert runbooks if needed

#### Procedures:

1. **Check Active Alerts**
   ```bash
   # Access Alertmanager UI
   kubectl port-forward svc/alertmanager 9093

   # Or check via API
   curl -s http://localhost:9093/api/v2/alerts | jq '.[] | select(.status.state == "firing") | {labels, annotations}'
   ```

2. **Alert Analysis**
   ```bash
   # Group alerts by severity
   curl -s http://localhost:9093/api/v2/alerts | jq 'group_by(.labels.severity) | map({severity: .[0].labels.severity, count: length})'

   # Check for alert patterns
   curl -s http://localhost:9093/api/v2/alerts | jq '.[] | select(.status.state == "firing") | .labels.alertname' | sort | uniq -c | sort -nr
   ```

3. **Alert Acknowledgment**
   ```bash
   # Acknowledge alerts via API
   curl -X POST http://localhost:9093/api/v2/alerts -H "Content-Type: application/json" -d '{
     "labels": {"alertname": "HighCPUUsage", "instance": "worker-01"},
     "startsAt": "2024-01-01T08:00:00Z"
   }'
   ```

4. **Silence Management**
   ```bash
   # Create silence for maintenance
   curl -X POST http://localhost:9093/api/v2/silences -H "Content-Type: application/json" -d '{
     "matchers": [
       {"name": "alertname", "value": "ScheduledMaintenance", "isRegex": false}
     ],
     "startsAt": "2024-01-01T22:00:00Z",
     "endsAt": "2024-01-02T02:00:00Z",
     "createdBy": "maintenance-team",
     "comment": "Scheduled database maintenance"
   }'
   ```

### Alert Response Procedures

**Critical Alerts (Severity: critical):**
- Immediate response required (< 5 minutes)
- Wake up on-call engineer if needed
- Escalate to incident response team
- Create incident ticket

**Warning Alerts (Severity: warning):**
- Response within 15 minutes during business hours
- Acknowledge and investigate
- Create ticket for resolution
- Monitor for escalation

**Info Alerts (Severity: info):**
- Review during daily standup
- Log for trending analysis
- Update documentation if needed

## Weekly Monitoring Review

### Monday Monitoring Assessment (9:30 AM UTC)

**Objective:** Comprehensive monitoring system review

**Duration:** 1 hour

**Responsible:** DevOps engineer

#### Review Checklist:
- [ ] Analyze alert trends and patterns
- [ ] Review dashboard effectiveness
- [ ] Check monitoring coverage gaps
- [ ] Verify metric collection health
- [ ] Review alerting rules accuracy
- [ ] Assess monitoring system performance
- [ ] Update monitoring runbooks

#### Procedures:

1. **Alert Trend Analysis**
   ```bash
   # Analyze alerts over the past week
   curl -s "http://localhost:9093/api/v2/alerts?start=$(date -d '7 days ago' +%s)" | jq 'group_by(.labels.alertname) | map({alert: .[0].labels.alertname, count: length}) | sort_by(.count) | reverse'
   ```

2. **Dashboard Review**
   ```bash
   # Check Grafana dashboard usage
   curl -H "Authorization: Bearer $GRAFANA_API_KEY" http://grafana/api/dashboards | jq '.[] | {title, tags, recent_views}'

   # Review slow dashboards
   kubectl logs deployment/grafana | grep -i "slow\|timeout" | tail -10
   ```

3. **Monitoring Coverage Assessment**
   ```bash
   # Check for unmonitored services
   kubectl get deployments -o name | while read dep; do
     name=$(echo $dep | cut -d/ -f2)
     if ! curl -s "http://prometheus:9090/api/v1/targets" | jq -r '.data.activeTargets[].labels.app' | grep -q "^$name$"; then
       echo "Unmonitored: $name"
     fi
   done
   ```

4. **Metric Health Check**
   ```bash
   # Check for stale metrics
   curl -s "http://prometheus:9090/api/v1/query?query=up == 0" | jq '.data.result[].metric'

   # Review metric ingestion rate
   curl -s "http://prometheus:9090/api/v1/query?query=rate(prometheus_tsdb_head_samples_appended_total[5m])" | jq '.data.result[0].value[1]'
   ```

## Monthly Alert Tuning

### First Monday Alert Optimization (10:00 AM UTC)

**Objective:** Tune alert thresholds and reduce noise

**Duration:** 2 hours

**Responsible:** DevOps engineer

#### Tuning Checklist:
- [ ] Review false positive alerts
- [ ] Adjust alert thresholds based on baselines
- [ ] Update alert rules for accuracy
- [ ] Implement alert aggregation
- [ ] Review alert dependencies
- [ ] Test alert configurations
- [ ] Update alert documentation

#### Procedures:

1. **False Positive Analysis**
   ```bash
   # Identify frequently firing alerts that get resolved quickly
   curl -s "http://localhost:9093/api/v2/alerts?start=$(date -d '30 days ago' +%s)" | jq '
     group_by(.labels.alertname)[] |
     select(length > 0) |
     {
       alertname: .[0].labels.alertname,
       total_fires: length,
       avg_duration: (map(.endsAt | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) | add / length - map(.startsAt | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime) | add / length) / 60
     } |
     select(.avg_duration < 5)
   '
   ```

2. **Threshold Adjustment**
   ```bash
   # Analyze metric distributions to set appropriate thresholds
   # Example: CPU usage analysis
   curl -s "http://prometheus:9090/api/v1/query_range?query=rate(container_cpu_usage_seconds_total[5m])&start=$(date -d '7 days ago' +%s)&end=$(date +%s)&step=3600" | jq '
     .data.result[0].values | map(.[1] | tonumber) | {
       min: min,
       max: max,
       avg: (add / length),
       p95: sort | .[length * 0.95 | floor],
       p99: sort | .[length * 0.99 | floor]
     }
   '
   ```

3. **Alert Rule Updates**
   ```yaml
   # Example: Updated alert rule with better thresholds
   - alert: HighCPUUsage
     expr: |
       rate(container_cpu_usage_seconds_total[5m]) /
       container_spec_cpu_quota * 100 > 85
     for: 10m  # Increased from 5m to reduce flapping
     labels:
       severity: warning
     annotations:
       summary: "High CPU usage detected"
       description: "CPU usage is {{ $value }}% for {{ $labels.pod }}"
       runbook_url: "https://docs.trixtech.com/runbooks/high-cpu"
   ```

4. **Alert Aggregation**
   ```yaml
   # Group related alerts
   - alert: MultiplePodFailures
     expr: count(kube_pod_status_phase{phase="Failed"}) > 3
     for: 5m
     labels:
       severity: critical
     annotations:
       summary: "Multiple pods failing"
       description: "{{ $value }} pods are in Failed state"
   ```

## Quarterly Dashboard Updates

### End of Quarter Dashboard Maintenance (Last Friday, 9:00 AM UTC)

**Objective:** Update and optimize monitoring dashboards

**Duration:** 4 hours

**Responsible:** DevOps engineer

#### Dashboard Checklist:
- [ ] Review dashboard usage and effectiveness
- [ ] Update visualizations with new metrics
- [ ] Optimize dashboard performance
- [ ] Add new business-relevant metrics
- [ ] Review and update alert panels
- [ ] Test dashboard functionality
- [ ] Update dashboard documentation

#### Procedures:

1. **Dashboard Usage Analysis**
   ```bash
   # Check most viewed dashboards
   curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     "http://grafana/api/search?query=&starred=false" | \
     jq 'sort_by(.recent_views) | reverse | .[0:10] | {title, recent_views, tags}'
   ```

2. **Dashboard Performance Optimization**
   ```bash
   # Identify slow queries in dashboards
   kubectl logs deployment/grafana | grep -i "query\|slow" | tail -20

   # Optimize PromQL queries
   # Example: Replace expensive queries with recording rules
   ```

3. **New Metric Integration**
   ```json
   // Add business metrics panel
   {
     "title": "Business Metrics",
     "type": "table",
     "targets": [
       {
         "expr": "sum(rate(bookings_created_total[1h])) by (service_type)",
         "legendFormat": "{{service_type}}"
       },
       {
         "expr": "sum(rate(payments_processed_total[1h])) by (payment_method)",
         "legendFormat": "{{payment_method}}"
       }
     ]
   }
   ```

4. **Alert Panel Updates**
   ```json
   // Update alert status panel
   {
     "title": "Active Alerts",
     "type": "table",
     "targets": [
       {
         "expr": "ALERTS{alertstate=\"firing\"}",
         "legendFormat": "{{alertname}}"
       }
     ],
     "fieldConfig": {
       "overrides": [
         {
           "matcher": { "id": "byName", "options": "severity" },
           "properties": [
             {
               "id": "thresholds",
               "value": {
                 "mode": "absolute",
                 "steps": [
                   { "color": "green", "value": null },
                   { "color": "red", "value": "critical" },
                   { "color": "orange", "value": "warning" }
                 ]
               }
             }
           ]
         }
       ]
     }
   }
   ```

## Alert Configuration Management

### Alert Rule Lifecycle

**Alert Creation Process:**
1. Identify monitoring requirement
2. Define alert conditions and thresholds
3. Create alert rule with appropriate labels
4. Add runbook documentation
5. Test alert in staging environment
6. Deploy to production with monitoring

**Alert Modification Process:**
1. Analyze current alert performance
2. Identify improvement opportunities
3. Update alert rule with changes
4. Test modified alert
5. Deploy with gradual rollout
6. Monitor for unintended consequences

**Alert Retirement Process:**
1. Identify alerts no longer needed
2. Document retirement reason
3. Remove alert rule
4. Update related documentation
5. Monitor for any dependencies

### Alert Testing Procedures

```bash
#!/bin/bash
# Alert testing script
# File: /opt/monitoring/test_alerts.sh

set -e

echo "Testing alert configurations..."

# Test high CPU alert
echo "Testing HighCPUUsage alert..."
kubectl run stress-test --image=busybox -- stress --cpu 2 --timeout 30
sleep 60

# Check if alert fired
alerts=$(curl -s "http://alertmanager:9093/api/v2/alerts" | jq '.[] | select(.labels.alertname == "HighCPUUsage") | length')
if [ "$alerts" -gt 0 ]; then
  echo "✓ HighCPUUsage alert fired correctly"
else
  echo "✗ HighCPUUsage alert did not fire"
fi

# Clean up
kubectl delete pod stress-test

# Test database connection alert
echo "Testing DatabaseConnectionLost alert..."
# Temporarily stop database
kubectl scale deployment postgres --replicas=0
sleep 60

alerts=$(curl -s "http://alertmanager:9093/api/v2/alerts" | jq '.[] | select(.labels.alertname == "DatabaseConnectionLost") | length')
if [ "$alerts" -gt 0 ]; then
  echo "✓ DatabaseConnectionLost alert fired correctly"
else
  echo "✗ DatabaseConnectionLost alert did not fire"
fi

# Restore database
kubectl scale deployment postgres --replicas=1

echo "Alert testing completed"
```

## Monitoring System Maintenance

### Prometheus Maintenance

**Weekly Prometheus Tasks:**
- [ ] Check TSDB head block size
- [ ] Review query performance
- [ ] Clean up unused metrics
- [ ] Update Prometheus configuration
- [ ] Check rule evaluation performance

**Monthly Prometheus Tasks:**
- [ ] Review retention settings
- [ ] Optimize storage usage
- [ ] Update recording rules
- [ ] Check federation status
- [ ] Review alert rule performance

### Grafana Maintenance

**Dashboard Organization:**
```bash
# Create dashboard folders
curl -X POST http://grafana/api/folders \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Business Metrics"}'

# Move dashboards to folders
curl -X POST http://grafana/api/dashboards/db \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dashboard": {...},
    "folderId": 1,
    "overwrite": true
  }'
```

**User and Permission Management:**
- Review user access permissions
- Clean up inactive users
- Update team memberships
- Audit dashboard permissions

## Performance Baseline Updates

### Baseline Update Process

**Quarterly Baseline Review:**
1. Collect 3 months of performance data
2. Calculate new baseline metrics (median, percentiles)
3. Update alert thresholds
4. Review and adjust SLOs
5. Update documentation

**Baseline Calculation:**
```bash
# Calculate new baselines
curl -s "http://prometheus:9090/api/v1/query_range?query=http_request_duration_seconds{quantile=\"0.95\"}&start=$(date -d '90 days ago' +%s)&end=$(date +%s)&step=86400" | jq '
  .data.result[0].values | map(.[1] | tonumber) | {
    current_baseline: (sort | .[length * 0.5 | floor]),
    p95_baseline: (sort | .[length * 0.95 | floor]),
    p99_baseline: (sort | .[length * 0.99 | floor])
  }
'
```

### SLO/SLA Updates

**Service Level Objectives:**
- API Availability: 99.9%
- API Latency (p95): < 500ms
- Error Rate: < 1%
- Data Durability: 99.999%

**SLA Review Process:**
- Compare actual performance vs targets
- Identify gaps and root causes
- Implement improvements
- Update targets based on business needs

## Monitoring Documentation

### Runbook Management

**Alert Runbook Template:**
```markdown
# Alert: [Alert Name]

## Description
Brief description of what this alert detects.

## Severity
- Critical/Warning/Info

## Impact
What happens when this alert fires.

## Diagnosis
Steps to diagnose the issue:
1. Check [relevant metrics/logs]
2. Verify [system components]
3. Test [connectivity/services]

## Resolution
Steps to resolve the issue:
1. [Immediate action]
2. [Investigation steps]
3. [Long-term fix]

## Prevention
How to prevent this alert from firing.

## Escalation
When and how to escalate this alert.
```

### Documentation Updates

**Monthly Documentation Review:**
- Update alert runbooks
- Review dashboard documentation
- Update monitoring procedures
- Add new metric definitions
- Review contact information

## Troubleshooting

### Common Monitoring Issues

#### Alert Flooding

**Symptoms:** Too many alerts firing simultaneously

**Solutions:**
1. Implement alert aggregation
2. Review and adjust alert thresholds
3. Use alert dependencies
4. Implement alert silencing rules

#### Missing Metrics

**Symptoms:** Expected metrics not appearing

**Solutions:**
1. Check metric collection configuration
2. Verify service discovery
3. Review network connectivity
4. Check application instrumentation

#### Slow Dashboards

**Symptoms:** Grafana dashboards loading slowly

**Solutions:**
1. Optimize PromQL queries
2. Implement query caching
3. Reduce data point density
4. Use recording rules for complex queries

#### Alertmanager Issues

**Symptoms:** Alerts not being sent or processed

**Solutions:**
1. Check Alertmanager configuration
2. Verify notification channels
3. Review routing rules
4. Test notification delivery

### Monitoring System Issues

#### Prometheus Performance

**Symptoms:** Prometheus slow or unresponsive

**Solutions:**
1. Check TSDB size and retention
2. Review query patterns
3. Optimize scrape intervals
4. Add more Prometheus instances

#### Grafana Issues

**Symptoms:** Grafana not loading or slow

**Solutions:**
1. Check database performance
2. Review plugin usage
3. Optimize dashboard queries
4. Update Grafana version

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Routine Maintenance](../maintenance/ROUTINE_MAINTENANCE.md)
- [Monitoring Troubleshooting](../troubleshooting/MONITORING_TROUBLESHOOTING.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review alert rules monthly. Update dashboards quarterly. Test monitoring systems biannually. Audit monitoring configurations annually.