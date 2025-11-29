# Performance Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Application Performance Monitoring (APM)](#application-performance-monitoring-apm)
4. [Database Performance Monitoring](#database-performance-monitoring)
5. [Infrastructure Performance Monitoring](#infrastructure-performance-monitoring)
6. [Load Testing Automation](#load-testing-automation)
7. [Performance Alerting](#performance-alerting)
8. [Automated Optimization](#automated-optimization)
9. [Performance Benchmarking](#performance-benchmarking)
10. [Troubleshooting](#troubleshooting)
11. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for setting up automated performance monitoring and optimization for the TRIXTECH Booking System. Performance monitoring ensures optimal system responsiveness, resource utilization, and user experience through continuous tracking, automated analysis, and proactive optimization.

## Prerequisites

- Application instrumentation (OpenTelemetry, Prometheus metrics)
- Database monitoring tools (pg_stat_statements, slow query logs)
- Load testing tools (k6, JMeter, Artillery)
- APM tools (DataDog, New Relic, or open-source alternatives)
- Performance baselines and SLIs/SLOs defined
- Resource monitoring (CPU, memory, disk, network)

### Required Tools

- Prometheus for metrics collection
- Grafana for visualization
- OpenTelemetry for application tracing
- pgBadger for PostgreSQL performance analysis
- k6 for load testing
- Custom performance scripts

### Performance Targets

- API Response Time: < 500ms (95th percentile)
- Database Query Time: < 100ms (95th percentile)
- Page Load Time: < 3 seconds
- Error Rate: < 1%
- CPU Utilization: < 80%
- Memory Utilization: < 85%

## Application Performance Monitoring (APM)

### OpenTelemetry Instrumentation

Implement distributed tracing:

```javascript
// backend/utils/tracing.js
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/sdk-trace-node');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const provider = new NodeTracerProvider();
const exporter = new JaegerExporter({
  endpoint: 'http://jaeger-collector:14268/api/traces',
});

provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
provider.register();

const tracer = opentelemetry.trace.getTracer('trixtech-backend');

// Middleware for automatic tracing
const tracingMiddleware = (req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.user_agent': req.get('User-Agent'),
    },
  });

  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'http.response_time': Date.now() - span.startTime,
    });
    span.end();
  });

  next();
};

module.exports = { tracer, tracingMiddleware };
```

### Custom Performance Metrics

Add application-specific metrics:

```javascript
// backend/utils/metrics.js
const promClient = require('prom-client');

const register = new promClient.Registry();

// HTTP metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

// Business metrics
const bookingCreatedCounter = new promClient.Counter({
  name: 'bookings_created_total',
  help: 'Total number of bookings created',
  labelNames: ['service_type', 'status']
});

const activeUsersGauge = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active users'
});

// Database metrics
const dbConnectionPoolSize = new promClient.Gauge({
  name: 'db_connection_pool_size',
  help: 'Database connection pool size'
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

register.registerMetric(httpRequestDuration);
register.registerMetric(bookingCreatedCounter);
register.registerMetric(activeUsersGauge);
register.registerMetric(dbConnectionPoolSize);
register.registerMetric(dbQueryDuration);

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  const end = res.end;
  const route = req.route ? req.route.path : req.path;

  res.end = function(...args) {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    end.apply(this, args);
  };

  next();
};

module.exports = {
  register,
  httpRequestDuration,
  bookingCreatedCounter,
  activeUsersGauge,
  dbConnectionPoolSize,
  dbQueryDuration,
  performanceMiddleware
};
```

### APM Dashboard Configuration

Create comprehensive APM dashboard:

```json
{
  "dashboard": {
    "title": "TRIXTECH Application Performance",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
            "legendFormat": "Error rate %"
          }
        ]
      },
      {
        "title": "Database Query Performance",
        "type": "table",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) by (table)",
            "legendFormat": "{{table}}"
          }
        ]
      },
      {
        "title": "Active Users",
        "type": "singlestat",
        "targets": [
          {
            "expr": "active_users",
            "legendFormat": "Active users"
          }
        ]
      }
    ]
  }
}
```

## Database Performance Monitoring

### PostgreSQL Performance Monitoring

Enable and configure PostgreSQL monitoring:

```sql
-- Enable pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Configure monitoring parameters
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET pg_stat_statements.track = 'all';
ALTER SYSTEM SET pg_stat_statements.track_utility = on;

-- Restart PostgreSQL service
-- (This would be done via Kubernetes rolling update)
```

### Automated Query Analysis

Implement automated slow query detection:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: query-performance-analysis
  namespace: database
spec:
  schedule: "0 */2 * * *"  # Every 2 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: query-analyzer
            image: postgres:13
            command:
            - sh
            - -c
            - |
              # Analyze slow queries
              psql -h postgres -U postgres -d trixtech << 'EOF'
              SELECT
                  query,
                  calls,
                  total_time / calls as avg_time,
                  rows,
                  shared_blks_hit,
                  shared_blks_read,
                  temp_blks_written
              FROM pg_stat_statements
              WHERE total_time / calls > 1000  -- Queries slower than 1 second
              ORDER BY total_time DESC
              LIMIT 10;
              EOF
          restartPolicy: OnFailure
```

### Database Index Optimization

Automated index analysis and recommendations:

```sql
-- Query to identify missing indexes
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname = 'public'
AND n_distinct > 100
AND correlation < 0.5
ORDER BY n_distinct DESC;

-- Query to identify unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

## Infrastructure Performance Monitoring

### Resource Monitoring

Comprehensive infrastructure monitoring:

```yaml
# Prometheus node exporter configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: node-exporter-config
  namespace: monitoring
data:
  node-exporter.yml: |
    collectors:
      enabled:
        - cpu
        - diskstats
        - filesystem
        - loadavg
        - meminfo
        - netdev
        - netstat
        - pressure
        - stat
        - thermal_zone
        - time
        - timex
        - uname
        - vmstat
```

### Kubernetes Performance Monitoring

Monitor cluster performance:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: k8s-performance-config
  namespace: monitoring
data:
  kube-state-metrics-config: |
    metricLabelsAllowlist:
      - pods=[app]
      - deployments=[app]
      - services=[app]
    metricAnnotationsAllowlist:
      - pods=[prometheus.io/scrape]
      - services=[prometheus.io/scrape]
```

### Network Performance Monitoring

Monitor network performance:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: network-monitoring
  namespace: monitoring
data:
  network-checks.sh: |
    #!/bin/bash
    # Network latency and throughput tests

    # Test latency to key services
    ping -c 5 database.default.svc.cluster.local | tail -1 | awk '{print $4}' | cut -d '/' -f 2

    # Test DNS resolution time
    time nslookup trixtech-backend.default.svc.cluster.local

    # Test network throughput
    iperf3 -c iperf-server -t 10 -J | jq '.end.sum_sent.bits_per_second / 1000000'
```

## Load Testing Automation

### Automated Load Testing

Implement automated load testing:

```javascript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate should be below 10%
  },
};

const BASE_URL = 'https://api.trixtech.com';

export default function () {
  // Test booking creation
  let response = http.post(`${BASE_URL}/api/bookings`, {
    service_id: 1,
    customer_name: 'Load Test User',
    booking_date: '2024-12-01T10:00:00Z',
  });

  check(response, {
    'booking creation status is 201': (r) => r.status === 201,
    'booking creation response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test booking retrieval
  let bookingId = response.json().id;
  response = http.get(`${BASE_URL}/api/bookings/${bookingId}`);

  check(response, {
    'booking retrieval status is 200': (r) => r.status === 200,
    'booking retrieval response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

### Load Testing Pipeline

Integrate load testing into CI/CD:

```yaml
# .github/workflows/load-test.yml
name: Load Testing

on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Run k6 load test
      uses: grafana/k6-action@v0.1.0
      with:
        filename: k6/load-test.js
        flags: --out json=results.json

    - name: Upload load test results
      uses: actions/upload-artifact@v3
      with:
        name: load-test-results
        path: results.json

    - name: Check performance thresholds
      run: |
        # Parse results and check against thresholds
        jq -e '.metrics.http_req_duration."95th_percentile" < 500' results.json
        jq -e '.metrics.http_req_failed.rate < 0.1' results.json
```

## Performance Alerting

### Performance Alert Rules

Create comprehensive performance alerts:

```yaml
groups:
- name: performance_alerts
  rules:

  # Response time alerts
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s for {{ $labels.service }}"

  - alert: CriticalResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 5
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Critical response time"
      description: "95th percentile response time is {{ $value }}s for {{ $labels.service }}"

  # Error rate alerts
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"[5].."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate"
      description: "Error rate is {{ $value }}% for {{ $labels.service }}"

  # Database performance alerts
  - alert: SlowDatabaseQueries
    expr: histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow database queries"
      description: "95th percentile query time is {{ $value }}s"

  - alert: DatabaseConnectionPoolExhausted
    expr: db_connection_pool_active_connections / db_connection_pool_max_size > 0.9
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Database connection pool exhausted"
      description: "Connection pool utilization is {{ $value }}%"

  # Resource alerts
  - alert: HighCPUUsage
    expr: rate(container_cpu_usage_seconds_total[5m]) / container_spec_cpu_quota * 100 > 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is {{ $value }}% for {{ $labels.pod }}"

  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes / container_spec_memory_limit_bytes * 100 > 85
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value }}% for {{ $labels.pod }}"

  # Business metric alerts
  - alert: LowBookingRate
    expr: rate(bookings_created_total[1h]) < 10
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "Low booking rate"
      description: "Booking rate is {{ $value }} bookings per hour"
```

## Automated Optimization

### Auto-scaling Based on Performance

Performance-aware auto-scaling:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: performance-based-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trixtech-backend
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_request_duration_seconds
      target:
        type: AverageValue
        averageValue: 500ms
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 300
```

### Automated Database Optimization

Database optimization CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-optimization
  namespace: database
spec:
  schedule: "0 3 * * 0"  # Weekly Sunday 3 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: db-optimizer
            image: postgres:13
            command:
            - sh
            - -c
            - |
              # Analyze tables for optimization
              psql -h postgres -U postgres -d trixtech -c "ANALYZE;"

              # Reindex if needed
              psql -h postgres -U postgres -d trixtech -c "REINDEX DATABASE trixtech;"

              # Vacuum analyze
              psql -h postgres -U postgres -d trixtech -c "VACUUM ANALYZE;"

              # Check for unused indexes
              psql -h postgres -U postgres -d trixtech -c "
              SELECT schemaname, tablename, indexname
              FROM pg_stat_user_indexes
              WHERE idx_scan = 0
              AND schemaname = 'public';
              " > unused_indexes.txt
          restartPolicy: OnFailure
```

## Performance Benchmarking

### Automated Benchmarking

Implement automated performance benchmarking:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: performance-benchmark
  namespace: default
spec:
  schedule: "0 4 * * 1"  # Weekly Monday 4 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: benchmark
            image: benchmark-tools:latest
            command:
            - /bin/bash
            - -c
            - |
              # Run API benchmarks
              ab -n 1000 -c 10 http://trixtech-backend:3000/api/health > api_benchmark.txt

              # Run database benchmarks
              pgbench -h postgres -U postgres -d trixtech -c 10 -j 2 -T 60 > db_benchmark.txt

              # Compare with previous benchmarks
              # (Store results in persistent volume for comparison)

              # Send results to monitoring system
              curl -X POST http://prometheus-pushgateway:9091/metrics/job/performance-benchmark \
                -T benchmark_results.txt
          restartPolicy: OnFailure
```

### Performance Regression Detection

Automated regression detection:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: performance-baselines
  namespace: monitoring
data:
  baselines.json: |
    {
      "api_response_time_p95": 500,
      "db_query_time_p95": 100,
      "error_rate": 0.01,
      "throughput": 1000
    }
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: regression-detection
  namespace: monitoring
spec:
  schedule: "0 */4 * * *"  # Every 4 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: regression-check
            image: python:3.9
            command:
            - python
            - -c
            - |
              import requests
              import json
              import sys

              # Load baselines
              with open('/config/baselines.json') as f:
                  baselines = json.load(f)

              # Query current metrics from Prometheus
              prometheus_url = 'http://prometheus:9090/api/v1/query'

              # Check response time regression
              response = requests.get(f'{prometheus_url}?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[1h]))')
              current_p95 = float(response.json()['data']['result'][0]['value'][1])

              if current_p95 > baselines['api_response_time_p95'] * 1.2:  # 20% degradation
                  print(f"Performance regression detected: P95 response time {current_p95}ms > baseline {baselines['api_response_time_p95']}ms")
                  sys.exit(1)

              print("No performance regressions detected")
          volumeMounts:
          - name: config-volume
            mountPath: /config
          volumes:
          - name: config-volume
            configMap:
              name: performance-baselines
          restartPolicy: OnFailure
```

## Troubleshooting

### Common Issues

#### High Response Times

**Symptoms:** API responses slower than expected

**Solutions:**
1. Check database query performance
2. Review application logs for bottlenecks
3. Analyze tracing data for slow operations
4. Check resource utilization (CPU/memory)

#### Memory Leaks

**Symptoms:** Memory usage continuously increasing

**Solutions:**
1. Enable heap dumps in Node.js
2. Analyze memory usage patterns
3. Check for object retention issues
4. Implement memory profiling

#### Database Slow Queries

**Symptoms:** Database queries taking too long

**Solutions:**
1. Analyze query execution plans
2. Check for missing indexes
3. Review table statistics
4. Optimize query structure

#### Auto-scaling Not Working

**Symptoms:** Application not scaling despite high load

**Solutions:**
1. Verify HPA configuration and metrics
2. Check resource requests/limits
3. Review scaling policies and cooldown periods
4. Test manual scaling

#### Load Test Failures

**Symptoms:** Load tests failing or showing poor performance

**Solutions:**
1. Check test environment configuration
2. Review test scenarios for realism
3. Analyze bottleneck identification
4. Compare with production metrics

### Debugging Steps

1. Check application metrics: `kubectl port-forward svc/prometheus 9090`
2. Review tracing data: `kubectl port-forward svc/jaeger 16686`
3. Analyze database performance: `kubectl exec -it postgres -- psql -c "SELECT * FROM pg_stat_activity;"`
4. Check resource usage: `kubectl top pods`
5. Run performance profiling: `kubectl exec -it app-pod -- node --prof app.js`

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Performance Maintenance](../maintenance/PERFORMANCE_MAINTENANCE.md)
- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review performance baselines quarterly. Update monitoring thresholds based on traffic patterns. Conduct load testing before major releases. Analyze performance trends monthly.