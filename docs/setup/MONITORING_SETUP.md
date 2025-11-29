# Monitoring Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Prometheus Setup](#prometheus-setup)
4. [Grafana Setup](#grafana-setup)
5. [Application Monitoring](#application-monitoring)
6. [Infrastructure Monitoring](#infrastructure-monitoring)
7. [Alert Configuration](#alert-configuration)
8. [Dashboard Creation](#dashboard-creation)
9. [Troubleshooting](#troubleshooting)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for setting up monitoring and alerting infrastructure using Prometheus and Grafana for the TRIXTECH Booking System. The monitoring solution provides real-time visibility into system health, performance metrics, and automated alerting for critical issues.

## Prerequisites

- Kubernetes cluster (v1.19+)
- Helm 3.x installed
- kubectl configured with cluster access
- Persistent storage for Prometheus data
- Domain name or ingress controller for Grafana access

### Required Resources

- **CPU**: Minimum 2 cores for Prometheus, 1 core for Grafana
- **Memory**: 4GB for Prometheus, 1GB for Grafana
- **Storage**: 50GB for Prometheus metrics data
- **Network**: Cluster-internal communication enabled

### Helm Repositories

Add required Helm repositories:

```bash
# Add Prometheus community repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts

# Add Grafana repo
helm repo add grafana https://grafana.github.io/helm-charts

# Update repositories
helm repo update
```

## Prometheus Setup

### Installation with Helm

1. Create namespace for monitoring:

```bash
kubectl create namespace monitoring
```

2. Install Prometheus using Helm:

```bash
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --set server.persistentVolume.enabled=true \
  --set server.persistentVolume.size=50Gi \
  --set server.retention=30d \
  --set alertmanager.enabled=true \
  --set nodeExporter.enabled=true \
  --set kubeStateMetrics.enabled=true \
  --set pushgateway.enabled=false
```

3. Verify installation:

```bash
kubectl get pods -n monitoring
kubectl get svc -n monitoring
```

### Prometheus Configuration

Create custom configuration for application metrics:

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s

    rule_files:
      - /etc/prometheus/alert_rules.yml

    alerting:
      alertmanagers:
        - static_configs:
            - targets:
              - alertmanager.monitoring.svc:9093

    scrape_configs:
      - job_name: 'kubernetes-apiservers'
        kubernetes_sd_configs:
          - role: endpoints
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        relabel_configs:
          - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
            action: keep
            regex: default;kubernetes;https

      - job_name: 'kubernetes-nodes'
        scheme: https
        tls_config:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
        kubernetes_sd_configs:
          - role: node
        relabel_configs:
          - action: labelmap
            regex: __meta_kubernetes_node_label_(.+)

      - job_name: 'trixtech-backend'
        static_configs:
          - targets: ['trixtech-backend:3001']
        metrics_path: '/metrics'
        scrape_interval: 10s

      - job_name: 'trixtech-frontend'
        static_configs:
          - targets: ['trixtech-frontend:3000']
        metrics_path: '/metrics'
        scrape_interval: 30s
```

Apply the configuration:

```bash
kubectl apply -f prometheus-config.yaml
```

## Grafana Setup

### Installation with Helm

Install Grafana:

```bash
helm install grafana grafana/grafana \
  --namespace monitoring \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --set adminPassword='admin123' \
  --set service.type=ClusterIP
```

### Grafana Configuration

1. Get Grafana admin password:

```bash
kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo
```

2. Create ingress for external access:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grafana-ingress
  namespace: monitoring
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - host: grafana.trixtech.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: grafana
            port:
              number: 80
```

3. Add Prometheus as data source:

```bash
# Port forward for initial setup
kubectl port-forward -n monitoring svc/grafana 3000:80

# Then configure data source via UI or API
curl -X POST http://admin:admin123@localhost:3000/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://prometheus-server.monitoring.svc.cluster.local",
    "access": "proxy",
    "isDefault": true
  }'
```

## Application Monitoring

### Backend Metrics

Add Prometheus metrics to the Node.js backend:

1. Install prometheus client:

```bash
cd backend
npm install prom-client
```

2. Create metrics middleware:

```javascript
// backend/utils/metrics.js
const promClient = require('prom-client');

const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

const bookingRequests = new promClient.Counter({
  name: 'booking_requests_total',
  help: 'Total number of booking requests',
  labelNames: ['status']
});

register.registerMetric(httpRequestDuration);
register.registerMetric(activeConnections);
register.registerMetric(bookingRequests);

module.exports = {
  register,
  httpRequestDuration,
  activeConnections,
  bookingRequests
};
```

3. Add metrics endpoint:

```javascript
// backend/server.js
const metrics = require('./utils/metrics');

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', metrics.register.contentType);
  res.end(await metrics.register.metrics());
});
```

### Frontend Metrics

For Next.js frontend monitoring:

```javascript
// frontend/pages/_app.js
import { init } from '@web3modal/ui'

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Initialize Web Vitals tracking
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log);
      getFID(console.log);
      getFCP(console.log);
      getLCP(console.log);
      getTTFB(console.log);
    });
  }, []);

  return <Component {...pageProps} />;
}
```

## Infrastructure Monitoring

### Kubernetes Metrics

The kube-state-metrics component provides:

- Pod status and resource usage
- Deployment and ReplicaSet status
- Service and Endpoint information
- Persistent Volume claims

### Node Exporter

Monitors node-level metrics:

- CPU usage and load
- Memory and swap usage
- Disk I/O and space
- Network statistics
- System processes

### Custom Exporters

For database monitoring, deploy postgres-exporter:

```bash
helm install postgres-exporter prometheus-community/prometheus-postgres-exporter \
  --namespace monitoring \
  --set config.datasourceName="postgresql://user:password@host:5432/dbname"
```

## Alert Configuration

### Alert Rules

Create alert rules file:

```yaml
# alert_rules.yml
groups:
- name: trixtech_alerts
  rules:

  # Application alerts
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}% for {{ $labels.service }}"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time"
      description: "95th percentile response time is {{ $value }}s"

  # Infrastructure alerts
  - alert: HighCPUUsage
    expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 90
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High CPU usage"
      description: "CPU usage is {{ $value }}% on {{ $labels.instance }}"

  - alert: HighMemoryUsage
    expr: (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 90
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value }}% on {{ $labels.instance }}"

  - alert: LowDiskSpace
    expr: (node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100 < 10
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Low disk space"
      description: "Disk space is {{ $value }}% available on {{ $labels.instance }}"

  # Kubernetes alerts
  - alert: PodCrashLooping
    expr: increase(kube_pod_container_status_restarts_total[10m]) > 5
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Pod crash looping"
      description: "Pod {{ $labels.pod }} is crash looping"

  - alert: DeploymentUnavailable
    expr: kube_deployment_status_replicas_unavailable > 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Deployment unavailable"
      description: "Deployment {{ $labels.deployment }} has unavailable replicas"
```

### Alertmanager Configuration

Configure alert routing:

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@trixtech.com'
  smtp_auth_username: 'alerts@trixtech.com'
  smtp_auth_password: 'your-app-password'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'email'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty'
  - match:
      severity: warning
    receiver: 'slack'

receivers:
- name: 'email'
  email_configs:
  - to: 'devops@trixtech.com'
    send_resolved: true

- name: 'slack'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts'
    send_resolved: true

- name: 'pagerduty'
  pagerduty_configs:
  - service_key: 'your-pagerduty-integration-key'
```

## Dashboard Creation

### Application Dashboard

Create a dashboard for application metrics:

```json
{
  "dashboard": {
    "title": "TRIXTECH Application Metrics",
    "tags": ["trixtech", "application"],
    "panels": [
      {
        "title": "HTTP Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      },
      {
        "title": "Response Time",
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
      }
    ]
  }
}
```

### Infrastructure Dashboard

Create infrastructure monitoring dashboard:

```json
{
  "dashboard": {
    "title": "TRIXTECH Infrastructure",
    "panels": [
      {
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "100 - (avg by(instance) (irate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100",
            "legendFormat": "{{instance}}"
          }
        ]
      },
      {
        "title": "Disk Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "(node_filesystem_size_bytes - node_filesystem_avail_bytes) / node_filesystem_size_bytes * 100",
            "legendFormat": "{{instance}} {{mountpoint}}"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### Common Issues

#### Prometheus Not Scraping Metrics

**Symptoms:** No metrics appearing in Prometheus

**Solutions:**
1. Check service discovery configuration
2. Verify target endpoints are accessible
3. Check firewall rules and network policies
4. Validate scrape configuration syntax

#### Grafana Cannot Connect to Prometheus

**Symptoms:** Data source connection fails

**Solutions:**
1. Verify Prometheus service URL
2. Check network connectivity between namespaces
3. Validate authentication credentials
4. Test connection manually with curl

#### Alerts Not Firing

**Symptoms:** Expected alerts not triggering

**Solutions:**
1. Check alert rule syntax with `promtool check rules`
2. Verify metric names and labels
3. Test expressions in Prometheus query interface
4. Check evaluation interval settings

#### High Memory Usage

**Symptoms:** Prometheus using excessive memory

**Solutions:**
1. Reduce retention period
2. Increase scrape intervals
3. Use fewer time series or higher aggregation
4. Add more memory to Prometheus pod

#### Slow Queries

**Symptoms:** Grafana dashboards loading slowly

**Solutions:**
1. Optimize PromQL queries
2. Use recording rules for complex expressions
3. Implement query caching
4. Add more CPU resources to Prometheus

### Debugging Steps

1. Check Prometheus targets: `http://prometheus:9090/targets`
2. View service discovery: `http://prometheus:9090/service-discovery`
3. Test alert rules: `http://prometheus:9090/alerts`
4. Check Grafana logs: `kubectl logs -n monitoring deployment/grafana`
5. Monitor resource usage: `kubectl top pods -n monitoring`

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Monitoring Maintenance](../maintenance/MONITORING_MAINTENANCE.md)
- [Monitoring Troubleshooting](../troubleshooting/MONITORING_TROUBLESHOOTING.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review alert rules quarterly. Update dashboards based on new metrics. Monitor resource usage and scale components as needed.