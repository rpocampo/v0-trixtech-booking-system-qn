# Monitoring Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Alert Configuration Issues](#alert-configuration-issues)
3. [False Positive Alerts](#false-positive-alerts)
4. [Missing Alerts](#missing-alerts)
5. [Prometheus Issues](#prometheus-issues)
6. [Grafana Problems](#grafana-problems)
7. [Metric Collection Problems](#metric-collection-problems)
8. [Dashboard Issues](#dashboard-issues)
9. [Alertmanager Problems](#alertmanager-problems)
10. [Performance Monitoring Issues](#performance-monitoring-issues)
11. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for monitoring system issues in the TRIXTECH Booking System. It covers alert configuration problems, false positives, missing alerts, and various monitoring infrastructure issues with step-by-step resolution procedures.

## Alert Configuration Issues

### Alert Rule Syntax Errors

**Symptoms:** Alert rules fail to load with syntax errors

**Common Causes:**
1. Invalid PromQL syntax
2. Incorrect label names
3. Missing or malformed operators
4. Invalid duration formats

**Solutions:**

1. **Validate PromQL Syntax**
   ```bash
   # Test PromQL expression
   curl -g "http://prometheus:9090/api/v1/query?query=up == 0"

   # Check for syntax errors
   promtool check rules /etc/prometheus/alert_rules.yml
   ```

2. **Common Syntax Issues**
   ```yaml
   # Incorrect: Missing quotes around label values
   - alert: HighCPUUsage
     expr: cpu_usage{instance=worker-01} > 80

   # Correct: Proper label matching
   - alert: HighCPUUsage
     expr: cpu_usage{instance="worker-01"} > 80

   # Incorrect: Invalid duration
   for: 5minutes

   # Correct: Valid duration
   for: 5m
   ```

3. **Test Alert Rules**
   ```bash
   # Test rule evaluation
   promtool test rules test.yml

   # Check rule groups
   curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.name == "trixtech_alerts")'
   ```

### Alert Threshold Issues

**Symptoms:** Alerts fire at wrong thresholds or not at all

**Common Causes:**
1. Incorrect threshold values
2. Wrong metric names
3. Time range issues
4. Aggregation problems

**Solutions:**

1. **Verify Metric Names**
   ```bash
   # List available metrics
   curl -s "http://prometheus:9090/api/v1/label/__name__/values" | jq '.data[]' | grep cpu

   # Check metric values
   curl -s "http://prometheus:9090/api/v1/query?query=cpu_usage" | jq '.data.result[0].value'
   ```

2. **Test Threshold Logic**
   ```bash
   # Test alert condition manually
   curl -s "http://prometheus:9090/api/v1/query?query=cpu_usage > 80" | jq '.data.result | length'

   # Check historical data
   curl -s "http://prometheus:9090/api/v1/query_range?query=cpu_usage&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60" | jq '.data.result[0].values[-5:]'
   ```

3. **Adjust Thresholds Based on Baselines**
   ```bash
   # Calculate baseline values
   curl -s "http://prometheus:9090/api/v1/query_range?query=cpu_usage&start=$(date -d '7 days ago' +%s)&end=$(date +%s)&step=3600" | jq '
     .data.result[0].values | map(.[1] | tonumber) | {
       avg: (add / length),
       p95: sort | .[length * 0.95 | floor],
       max: max
     }
   '
   ```

## False Positive Alerts

### Alert Flapping

**Symptoms:** Alerts fire and resolve repeatedly

**Common Causes:**
1. Thresholds too close to normal operation
2. Short evaluation intervals
3. Inconsistent metric values
4. Network instability

**Solutions:**

1. **Increase Stabilization Window**
   ```yaml
   # Add stabilization window to reduce flapping
   - alert: HighCPUUsage
     expr: cpu_usage > 80
     for: 10m  # Increased from 5m
     labels:
       severity: warning
   ```

2. **Use Percentiles Instead of Absolute Values**
   ```yaml
   # Use rolling percentiles
   - alert: HighResponseTime
     expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 0.5
     for: 5m
   ```

3. **Implement Alert Dependencies**
   ```yaml
   # Only alert if multiple conditions are met
   - alert: ServiceDown
     expr: up == 0 and probe_success == 0
     for: 5m
     labels:
       severity: critical
   ```

### Temporary Spikes

**Symptoms:** Alerts triggered by temporary spikes that resolve quickly

**Common Causes:**
1. Batch job executions
2. Automated scaling events
3. Maintenance operations
4. Network blips

**Solutions:**

1. **Exclude Known Maintenance Windows**
   ```yaml
   # Add maintenance window filter
   - alert: HighCPUUsage
     expr: cpu_usage > 80 and absent(maintenance_window)
     for: 5m
   ```

2. **Use Rate-Based Alerts**
   ```yaml
   # Alert on sustained high usage, not spikes
   - alert: SustainedHighCPU
     expr: avg_over_time(cpu_usage[10m]) > 80
     for: 5m
   ```

3. **Implement Alert Silencing**
   ```bash
   # Silence alerts during known events
   curl -X POST http://alertmanager:9093/api/v2/silences \
     -H "Content-Type: application/json" \
     -d '{
       "matchers": [{"name": "alertname", "value": "HighCPUUsage"}],
       "startsAt": "2024-01-01T02:00:00Z",
       "endsAt": "2024-01-01T04:00:00Z",
       "createdBy": "automation",
       "comment": "Scheduled maintenance"
     }'
   ```

### Noisy Alerts

**Symptoms:** Too many alerts for the same issue

**Common Causes:**
1. Multiple alerts for same problem
2. Alert proliferation
3. Overlapping alert conditions
4. Insufficient aggregation

**Solutions:**

1. **Alert Aggregation**
   ```yaml
   # Group similar alerts
   - alert: MultiplePodsFailing
     expr: count(kube_pod_status_phase{phase="Failed"}) > 3
     for: 2m
     labels:
       severity: critical
     annotations:
       summary: "{{ $value }} pods are failing"
   ```

2. **Alert Inhibition**
   ```yaml
   # Suppress lower-priority alerts when higher-priority ones fire
   inhibit_rules:
   - source_match:
       severity: 'critical'
     target_match:
       severity: 'warning'
     equal: ['alertname', 'instance']
   ```

3. **Alert Dependencies**
   ```yaml
   # Only alert on dependent failures
   - alert: DatabaseConnectionFailed
     expr: mysql_up == 0 and api_up == 0
     for: 5m
   ```

## Missing Alerts

### Alerts Not Firing

**Symptoms:** Expected alerts don't trigger despite conditions being met

**Common Causes:**
1. Alert rules not loaded
2. Metric collection failures
3. Label mismatches
4. Evaluation interval issues

**Solutions:**

1. **Check Alert Rule Loading**
   ```bash
   # Verify rules are loaded
   curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[] | select(.rules[]?.name == "HighCPUUsage")'

   # Check for rule errors
   curl -s http://prometheus:9090/api/v1/alerts | jq '.data.alerts[] | select(.state == "inactive")'
   ```

2. **Verify Metric Collection**
   ```bash
   # Check if metrics are being collected
   curl -s "http://prometheus:9090/api/v1/query?query=up{job=\"kubernetes\"}" | jq '.data.result | length'

   # Check metric timestamps
   curl -s "http://prometheus:9090/api/v1/query?query=cpu_usage" | jq '.data.result[0].value[0]'
   ```

3. **Debug Label Matching**
   ```bash
   # Check label values
   curl -s "http://prometheus:9090/api/v1/query?query=cpu_usage" | jq '.data.result[0].metric'

   # Test alert condition with labels
   curl -s "http://prometheus:9090/api/v1/query?query=cpu_usage{instance=\"worker-01\"} > 80"
   ```

### Alertmanager Issues

**Symptoms:** Alerts generated but not delivered

**Common Causes:**
1. Routing configuration errors
2. Notification channel failures
3. Silencing rules blocking alerts
4. Rate limiting

**Solutions:**

1. **Check Alertmanager Status**
   ```bash
   # Check Alertmanager health
   curl -s http://alertmanager:9093/api/v2/status | jq '.cluster'

   # View active silences
   curl -s http://alertmanager:9093/api/v2/silences | jq '.[] | select(.status.state == "active")'
   ```

2. **Test Notification Channels**
   ```bash
   # Test email notification
   curl -X POST http://alertmanager:9093/api/v2/alerts \
     -H "Content-Type: application/json" \
     -d '[{"labels": {"alertname": "TestAlert"}, "annotations": {"summary": "Test alert"}}]'

   # Check webhook delivery
   kubectl logs deployment/alertmanager -f | grep webhook
   ```

3. **Verify Routing Rules**
   ```yaml
   # Check route configuration
   route:
     group_by: ['alertname']
     group_wait: 10s
     group_interval: 10s
     repeat_interval: 1h
     receiver: 'default'
     routes:
     - match:
         severity: critical
       receiver: 'critical-pager'
   ```

## Prometheus Issues

### High Cardinality

**Symptoms:** Prometheus performance degradation, high memory usage

**Common Causes:**
1. Too many time series
2. Excessive label combinations
3. Metric proliferation
4. Inefficient queries

**Solutions:**

1. **Identify High Cardinality Metrics**
   ```bash
   # Check series count by metric
   curl -s "http://prometheus:9090/api/v1/query?query=count by (__name__) ({__name__=~\".*\"})" | jq '.data.result | sort_by(.value[1] | tonumber) | reverse[0:10]'

   # Check label cardinality
   curl -s "http://prometheus:9090/api/v1/query?query=count by (instance) (up)" | jq '.data.result | length'
   ```

2. **Optimize Metric Collection**
   ```yaml
   # Reduce unnecessary labels
   metric_relabel_configs:
   - source_labels: [__name__, label_to_remove]
     regex: 'http_requests_total;.*'
     action: labeldrop

   # Use metric aggregation
   - source_labels: [__name__]
     regex: 'http_requests_total'
     action: replace
     target_label: __name__
     replacement: http_requests_aggregated
   ```

3. **Implement Recording Rules**
   ```yaml
   # Pre-compute expensive queries
   groups:
   - name: recording_rules
     rules:
     - record: job:http_requests_total:rate5m
       expr: sum(rate(http_requests_total[5m])) by (job)
   ```

### Data Ingestion Problems

**Symptoms:** Metrics not appearing or delayed

**Common Causes:**
1. Scrape target failures
2. Network issues
3. Authentication problems
4. Configuration errors

**Solutions:**

1. **Check Scrape Targets**
   ```bash
   # List scrape targets
   curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.health == "down") | .labels'

   # Check target health
   curl -s http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | {labels: .labels, health: .health, lastError: .lastError}'
   ```

2. **Debug Scrape Configuration**
   ```yaml
   # Test scrape configuration
   global:
     scrape_interval: 15s
     evaluation_interval: 15s

   scrape_configs:
   - job_name: 'kubernetes'
     kubernetes_sd_configs:
     - role: pod
     relabel_configs:
     - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
       regex: "true"
       action: keep
   ```

3. **Network Connectivity**
   ```bash
   # Test connectivity to targets
   kubectl exec -it prometheus-pod -- curl -f http://target-service:9090/metrics

   # Check service discovery
   kubectl get endpoints target-service
   ```

## Grafana Problems

### Dashboard Loading Issues

**Symptoms:** Dashboards slow to load or fail to render

**Common Causes:**
1. Complex queries
2. Large time ranges
3. Too many data points
4. Database performance

**Solutions:**

1. **Optimize Queries**
   ```sql
   # Use query variables to reduce data
   SELECT
     time_bucket('1 hour', time) as hour,
     avg(value) as avg_value
   FROM metrics
   WHERE $__timeFilter(time)
   GROUP BY hour
   ORDER BY hour
   ```

2. **Reduce Data Points**
   ```json
   // Set appropriate max data points
   {
     "targets": [
       {
         "expr": "cpu_usage",
         "maxDataPoints": 1000,
         "interval": "1m"
       }
     ]
   }
   ```

3. **Use Template Variables**
   ```json
   // Add instance selector
   {
     "name": "instance",
     "query": "label_values(instance)",
     "type": "query"
   }
   ```

### Authentication Issues

**Symptoms:** Unable to access Grafana or dashboards

**Common Causes:**
1. Authentication configuration
2. User permissions
3. Session timeouts
4. LDAP/AD integration issues

**Solutions:**

1. **Check Authentication Configuration**
   ```ini
   # grafana.ini
   [auth.generic_oauth]
   enabled = true
   client_id = your_client_id
   client_secret = your_client_secret
   scopes = openid profile email
   auth_url = https://auth.example.com/oauth/authorize
   token_url = https://auth.example.com/oauth/token
   api_url = https://auth.example.com/oauth/userinfo
   ```

2. **Verify User Permissions**
   ```bash
   # Check user roles
   curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     http://grafana/api/users | jq '.[] | {id, login, role}'

   # Check dashboard permissions
   curl -H "Authorization: Bearer $GRAFANA_API_KEY" \
     http://grafana/api/dashboards/uid/dashboard-uid/permissions
   ```

3. **Debug LDAP Integration**
   ```ini
   # LDAP configuration
   [[servers]]
   host = "ldap.example.com"
   port = 389
   bind_dn = "cn=admin,dc=example,dc=com"
   bind_password = "secret"
   search_base_dns = ["dc=example,dc=com"]
   ```

## Metric Collection Problems

### Application Metrics Missing

**Symptoms:** Custom application metrics not appearing

**Common Causes:**
1. Instrumentation issues
2. Exporter configuration
3. Network policies
4. Metric naming conflicts

**Solutions:**

1. **Check Application Instrumentation**
   ```javascript
   // Verify metrics endpoint
   app.get('/metrics', async (req, res) => {
     res.set('Content-Type', promClient.register.contentType);
     res.end(await promClient.register.metrics());
   });

   // Test metrics locally
   curl http://localhost:3000/metrics | grep -E "(http_requests_total|bookings_created_total)"
   ```

2. **Verify Service Discovery**
   ```yaml
   # Check pod annotations
   kubectl get pods -o yaml | grep -A 5 annotations | grep prometheus

   # Verify service monitor
   kubectl get servicemonitors
   ```

3. **Debug Metric Collection**
   ```bash
   # Test metrics endpoint from Prometheus
   kubectl exec -it prometheus-pod -- curl -f http://target-pod:3000/metrics

   # Check Prometheus scrape logs
   kubectl logs deployment/prometheus | grep -i "target\|scrape\|error"
   ```

### Infrastructure Metrics Issues

**Symptoms:** Node or Kubernetes metrics not available

**Common Causes:**
1. Exporter not running
2. RBAC permissions
3. Network policies
4. Resource constraints

**Solutions:**

1. **Check Exporter Status**
   ```bash
   # Verify node exporter
   kubectl get daemonset node-exporter

   # Check kube-state-metrics
   kubectl get deployment kube-state-metrics
   ```

2. **Verify RBAC Permissions**
   ```yaml
   # Check service account permissions
   apiVersion: rbac.authorization.k8s.io/v1
   kind: ClusterRole
   metadata:
     name: prometheus
   rules:
   - apiGroups: [""]
     resources: ["nodes", "nodes/proxy", "services", "endpoints", "pods"]
     verbs: ["get", "list", "watch"]
   ```

3. **Network Policy Issues**
   ```yaml
   # Allow Prometheus to scrape metrics
   apiVersion: networking.k8s.io/v1
   kind: NetworkPolicy
   metadata:
     name: allow-prometheus
   spec:
     podSelector:
       matchLabels:
         app: your-app
     policyTypes:
     - Ingress
     ingress:
     - from:
       - podSelector:
           matchLabels:
             app: prometheus
       ports:
       - protocol: TCP
         port: 9090
   ```

## Dashboard Issues

### Visualization Problems

**Symptoms:** Charts not displaying correctly or showing wrong data

**Common Causes:**
1. Query syntax errors
2. Time range issues
3. Data format problems
4. Panel configuration

**Solutions:**

1. **Debug Queries**
   ```bash
   # Test query in Prometheus
   curl -s "http://prometheus:9090/api/v1/query?query=up" | jq '.data.result'

   # Check query range
   curl -s "http://prometheus:9090/api/v1/query_range?query=up&start=$(date +%s)&end=$(date +%s)&step=60"
   ```

2. **Fix Time Range Issues**
   ```json
   // Use relative time ranges
   {
     "time": {
       "from": "now-1h",
       "to": "now"
     }
   }

   // Use template variables
   {
     "templating": {
       "list": [
         {
           "name": "interval",
           "query": "1h,6h,12h,24h,7d",
           "type": "custom"
         }
       ]
     }
   }
   ```

3. **Data Format Issues**
   ```json
   // Ensure proper field configuration
   {
     "fieldConfig": {
       "defaults": {
         "unit": "percent",
         "min": 0,
         "max": 100
       }
     }
   }
   ```

### Performance Issues

**Symptoms:** Dashboards slow to load or unresponsive

**Common Causes:**
1. Too many panels
2. Complex queries
3. Large time ranges
4. Insufficient resources

**Solutions:**

1. **Optimize Panel Count**
   ```json
   // Use row collapsing
   {
     "collapsed": true,
     "panels": [...]
   }

   // Implement dashboard folders
   {
     "meta": {
       "folder": "Performance"
     }
   }
   ```

2. **Query Optimization**
   ```promql
   # Use recording rules for expensive queries
   sum(rate(http_requests_total[5m])) by (status)

   # Instead of:
   sum by (status) (rate(http_requests_total[5m]))
   ```

3. **Resource Allocation**
   ```yaml
   # Increase Grafana resources
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: grafana
   spec:
     template:
       spec:
         containers:
         - name: grafana
           resources:
             requests:
               memory: "256Mi"
               cpu: "100m"
             limits:
               memory: "512Mi"
               cpu: "500m"
   ```

## Alertmanager Problems

### Routing Issues

**Symptoms:** Alerts not reaching correct receivers

**Common Causes:**
1. Route configuration errors
2. Label matching issues
3. Receiver configuration problems
4. Group configuration

**Solutions:**

1. **Debug Routing Logic**
   ```bash
   # Test route matching
   curl -X POST http://alertmanager:9093/api/v2/alerts \
     -H "Content-Type: application/json" \
     -d '[{"labels": {"alertname": "HighCPUUsage", "severity": "critical"}}]'

   # Check active routes
   curl -s http://alertmanager:9093/api/v2/routes | jq '.'
   ```

2. **Verify Receiver Configuration**
   ```yaml
   # Test receiver configuration
   receivers:
   - name: 'slack'
     slack_configs:
     - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
       channel: '#alerts'
       send_resolved: true
       title: '{{ .GroupLabels.alertname }}'
       text: '{{ .CommonAnnotations.summary }}'
   ```

3. **Check Group Configuration**
   ```yaml
   # Adjust grouping settings
   route:
     group_by: ['alertname', 'instance']
     group_wait: 30s
     group_interval: 5m
     repeat_interval: 4h
   ```

### Notification Failures

**Symptoms:** Alerts generated but notifications not sent

**Common Causes:**
1. Authentication issues
2. Rate limiting
3. Network problems
4. Service outages

**Solutions:**

1. **Test Notification Channels**
   ```bash
   # Test webhook delivery
   curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
     -H "Content-Type: application/json" \
     -d '{"text": "Test notification"}'

   # Test email delivery
   curl -X POST http://alertmanager:9093/api/v2/alerts \
     -H "Content-Type: application/json" \
     -d '[{"labels": {"alertname": "TestAlert"}}]'
   ```

2. **Check Rate Limits**
   ```yaml
   # Implement rate limiting
   receivers:
   - name: 'slack'
     slack_configs:
     - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK'
       send_resolved: false  # Reduce notification volume
   ```

3. **Debug Network Issues**
   ```bash
   # Check connectivity from Alertmanager
   kubectl exec -it alertmanager-pod -- curl -v https://hooks.slack.com/

   # Check DNS resolution
   kubectl exec -it alertmanager-pod -- nslookup hooks.slack.com
   ```

## Performance Monitoring Issues

### Slow Queries

**Symptoms:** Monitoring queries taking too long

**Common Causes:**
1. Large time ranges
2. Complex expressions
3. High cardinality
4. Inefficient selectors

**Solutions:**

1. **Optimize Query Ranges**
   ```promql
   # Use appropriate time ranges
   rate(http_requests_total[5m])  # Instead of [1h]

   # Use instant queries for current values
   up{job="kubernetes"}
   ```

2. **Simplify Expressions**
   ```promql
   # Use recording rules for complex expressions
   sum(rate(http_requests_total[5m])) by (status)

   # Avoid cross-product operations
   # Bad: metric_a * on(instance) metric_b
   # Good: metric_a + on(instance) metric_b
   ```

3. **Reduce Cardinality**
   ```promql
   # Use specific label matchers
   cpu_usage{instance=~"worker-.*"}

   # Avoid broad selectors
   # Bad: {__name__=~".*"}
   # Good: {__name__="cpu_usage"}
   ```

### Memory Issues

**Symptoms:** Monitoring system using excessive memory

**Common Causes:**
1. Large number of time series
2. Long retention periods
3. Inefficient queries
4. Memory leaks

**Solutions:**

1. **Reduce Time Series**
   ```yaml
   # Implement metric relabeling
   metric_relabel_configs:
   - source_labels: [__name__]
     regex: '.*_total'
     action: drop  # Drop high-cardinality counters
   ```

2. **Optimize Retention**
   ```yaml
   # Adjust retention settings
   global:
     scrape_interval: 30s  # Increase from 15s
     evaluation_interval: 30s

   # Use downsampling for historical data
   ```

3. **Query Optimization**
   ```bash
   # Use query logging to identify slow queries
   curl -s "http://prometheus:9090/api/v1/query?query=slow_queries_total"

   # Implement query timeouts
   ```

## Related Documentation

- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Monitoring Maintenance](../maintenance/MONITORING_MAINTENANCE.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review alert configurations monthly. Update thresholds based on baseline changes. Audit monitoring coverage quarterly. Test alert scenarios biannually.