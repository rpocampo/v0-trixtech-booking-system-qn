# Configuration Reference

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Environment Variables](#environment-variables)
3. [Configuration File Formats](#configuration-file-formats)
4. [Thresholds and Limits](#thresholds-and-limits)
5. [Integration Endpoints](#integration-endpoints)
6. [Database Configuration](#database-configuration)
7. [Security Configuration](#security-configuration)
8. [Monitoring Configuration](#monitoring-configuration)
9. [Performance Configuration](#performance-configuration)
10. [Related Documentation](#related-documentation)

## Introduction

This document provides comprehensive reference for all configuration parameters used in the TRIXTECH Booking System. It includes environment variables, configuration file formats, thresholds, limits, and integration endpoints required for proper system operation.

## Environment Variables

### Application Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `NODE_ENV` | Application environment | `development` | Yes | `production` |
| `PORT` | Application port | `3000` | No | `8080` |
| `HOST` | Application host | `0.0.0.0` | No | `localhost` |
| `LOG_LEVEL` | Logging level | `info` | No | `debug` |
| `API_VERSION` | API version prefix | `v1` | No | `v2` |
| `CORS_ORIGIN` | CORS allowed origins | `*` | No | `https://app.trixtech.com` |
| `RATE_LIMIT_WINDOW` | Rate limit window (ms) | `900000` | No | `600000` |
| `RATE_LIMIT_MAX` | Rate limit max requests | `100` | No | `50` |

### Database Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `DATABASE_URL` | Database connection URL | - | Yes | `postgresql://user:pass@host:5432/db` |
| `DB_HOST` | Database host | `localhost` | No | `postgres.trixtech.svc.cluster.local` |
| `DB_PORT` | Database port | `5432` | No | `5432` |
| `DB_NAME` | Database name | `trixtech` | No | `trixtech_prod` |
| `DB_USER` | Database username | - | Yes | `trixtech_app` |
| `DB_PASSWORD` | Database password | - | Yes | `secure_password` |
| `DB_SSL` | Enable SSL connection | `true` | No | `false` |
| `DB_MAX_CONNECTIONS` | Maximum connections | `20` | No | `50` |
| `DB_IDLE_TIMEOUT` | Idle timeout (ms) | `30000` | No | `60000` |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | `2000` | No | `5000` |

### Authentication & Security

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `JWT_SECRET` | JWT signing secret | - | Yes | `your-256-bit-secret` |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` | No | `12h` |
| `BCRYPT_ROUNDS` | Password hashing rounds | `12` | No | `10` |
| `SESSION_SECRET` | Session secret | - | Yes | `session-secret-key` |
| `SESSION_TIMEOUT` | Session timeout (ms) | `3600000` | No | `7200000` |
| `OAUTH_CLIENT_ID` | OAuth client ID | - | No | `oauth-client-id` |
| `OAUTH_CLIENT_SECRET` | OAuth client secret | - | No | `oauth-client-secret` |
| `OAUTH_REDIRECT_URL` | OAuth redirect URL | - | No | `https://app.trixtech.com/auth/callback` |

### Payment Processing

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `PAYMENT_GATEWAY_URL` | Payment gateway URL | - | Yes | `https://api.payment-gateway.com` |
| `PAYMENT_API_KEY` | Payment API key | - | Yes | `pk_live_...` |
| `PAYMENT_WEBHOOK_SECRET` | Webhook secret | - | Yes | `whsec_...` |
| `PAYMENT_TIMEOUT` | Payment timeout (ms) | `30000` | No | `45000` |
| `PAYMENT_RETRY_ATTEMPTS` | Retry attempts | `3` | No | `5` |
| `PAYMENT_CURRENCY` | Default currency | `PHP` | No | `USD` |

### Email Configuration

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `SMTP_HOST` | SMTP server host | - | Yes | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` | No | `465` |
| `SMTP_USER` | SMTP username | - | Yes | `noreply@trixtech.com` |
| `SMTP_PASS` | SMTP password | - | Yes | `app-password` |
| `SMTP_SECURE` | Use TLS | `true` | No | `false` |
| `EMAIL_FROM` | From email address | - | Yes | `noreply@trixtech.com` |
| `EMAIL_FROM_NAME` | From name | `TRIXTECH` | No | `TRIXTECH Support` |

### File Storage

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `STORAGE_TYPE` | Storage backend | `local` | No | `s3` |
| `STORAGE_BUCKET` | Storage bucket name | - | No | `trixtech-uploads` |
| `AWS_REGION` | AWS region | `us-east-1` | No | `ap-southeast-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key | - | No | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | - | No | `secret-key` |
| `MAX_FILE_SIZE` | Maximum file size (MB) | `10` | No | `50` |
| `ALLOWED_FILE_TYPES` | Allowed file types | `jpg,jpeg,png,pdf` | No | `jpg,jpeg,png,pdf,doc,docx` |

### Monitoring & Observability

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `PROMETHEUS_PORT` | Prometheus metrics port | `9090` | No | `9090` |
| `METRICS_PATH` | Metrics endpoint path | `/metrics` | No | `/metrics` |
| `TRACING_ENABLED` | Enable tracing | `true` | No | `false` |
| `JAEGER_ENDPOINT` | Jaeger endpoint | - | No | `http://jaeger:14268/api/traces` |
| `LOG_FORMAT` | Log format | `json` | No | `text` |
| `LOG_FILE` | Log file path | - | No | `/var/log/trixtech/app.log` |

### External Integrations

| Variable | Description | Default | Required | Example |
|----------|-------------|---------|----------|---------|
| `SLACK_WEBHOOK_URL` | Slack webhook URL | - | No | `https://hooks.slack.com/...` |
| `PAGERDUTY_INTEGRATION_KEY` | PagerDuty key | - | No | `integration-key` |
| `DATADOG_API_KEY` | DataDog API key | - | No | `api-key` |
| `SENTRY_DSN` | Sentry DSN | - | No | `https://sentry.io/...` |

## Configuration File Formats

### Application Configuration (YAML)

```yaml
# config/application.yml
app:
  name: "TRIXTECH Booking System"
  version: "1.0.0"
  environment: "production"

server:
  port: 3000
  host: "0.0.0.0"
  timeout: 30000

database:
  host: "postgres.trixtech.svc.cluster.local"
  port: 5432
  name: "trixtech"
  ssl: true
  pool:
    min: 5
    max: 20
    idle: 30000

cache:
  redis:
    host: "redis.trixtech.svc.cluster.local"
    port: 6379
    ttl: 3600

monitoring:
  prometheus:
    enabled: true
    path: "/metrics"
  tracing:
    jaeger:
      enabled: true
      endpoint: "http://jaeger:14268/api/traces"
```

### Kubernetes Deployment Configuration

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trixtech-backend
  template:
    metadata:
      labels:
        app: trixtech-backend
    spec:
      containers:
      - name: backend
        image: trixtech/backend:v1.2.3
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    region: "ap-southeast-1"
    environment: "production"

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093

scrape_configs:
  - job_name: 'trixtech-backend'
    static_configs:
      - targets: ['trixtech-backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        regex: "true"
        action: keep
```

### Alertmanager Configuration

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@trixtech.com'
  smtp_auth_username: 'alerts@trixtech.com'
  smtp_auth_password: 'app-password'

route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'slack'
  routes:
  - match:
      severity: critical
    receiver: 'pagerduty'

receivers:
- name: 'slack'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
    channel: '#alerts'
    send_resolved: true
    title: '{{ .GroupLabels.alertname }}'
    text: '{{ .CommonAnnotations.summary }}'

- name: 'pagerduty'
  pagerduty_configs:
  - service_key: 'your-pagerduty-integration-key'
```

## Thresholds and Limits

### Performance Thresholds

| Metric | Warning | Critical | Description |
|--------|---------|----------|-------------|
| API Response Time (95th percentile) | 500ms | 2000ms | End-to-end API response time |
| Database Query Time (95th percentile) | 100ms | 500ms | Database query execution time |
| Error Rate | 1% | 5% | Percentage of failed requests |
| CPU Utilization | 70% | 90% | Average CPU usage |
| Memory Utilization | 80% | 95% | Memory usage percentage |
| Disk Usage | 80% | 95% | Storage utilization |
| Network Latency | 50ms | 200ms | Network round-trip time |

### Capacity Limits

| Resource | Soft Limit | Hard Limit | Description |
|----------|------------|------------|-------------|
| Concurrent Users | 10,000 | 25,000 | Maximum simultaneous users |
| API Requests/minute | 50,000 | 100,000 | API call rate limit |
| Database Connections | 100 | 200 | Active database connections |
| File Upload Size | 10MB | 50MB | Maximum file size |
| Session Duration | 24 hours | 7 days | User session lifetime |
| Cache Size | 1GB | 5GB | Application cache size |
| Log Retention | 30 days | 90 days | Log storage duration |

### Rate Limits

| Endpoint | Limit | Window | Description |
|----------|-------|--------|-------------|
| Authentication | 5/minute | per IP | Login attempt rate |
| API Calls | 100/minute | per user | General API usage |
| File Uploads | 10/minute | per user | File upload rate |
| Search Requests | 30/minute | per user | Search operation rate |
| Booking Creation | 20/minute | per user | Booking creation rate |
| Payment Processing | 5/minute | per user | Payment attempt rate |

### Alert Thresholds

| Alert Type | Warning Threshold | Critical Threshold | Evaluation Period |
|------------|-------------------|-------------------|------------------|
| CPU Usage | 70% | 90% | 5 minutes |
| Memory Usage | 80% | 95% | 5 minutes |
| Disk Usage | 80% | 95% | 15 minutes |
| Error Rate | 1% | 5% | 5 minutes |
| Response Time | 500ms | 2000ms | 5 minutes |
| Database Connections | 80% | 95% | 2 minutes |
| Queue Length | 100 | 500 | 2 minutes |

## Integration Endpoints

### Payment Gateway

| Environment | Endpoint | Method | Description |
|-------------|----------|--------|-------------|
| Production | `https://api.payment-gateway.com/v2/payments` | POST | Process payments |
| Production | `https://api.payment-gateway.com/v2/refunds` | POST | Process refunds |
| Production | `https://api.payment-gateway.com/v2/webhooks` | POST | Payment webhooks |
| Sandbox | `https://sandbox.payment-gateway.com/v2/payments` | POST | Test payments |

### Email Service

| Service | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| SendGrid | `https://api.sendgrid.com/v3/mail/send` | POST | Send emails |
| Mailgun | `https://api.mailgun.net/v3/{domain}/messages` | POST | Send emails |
| SES | `https://email.us-east-1.amazonaws.com/` | POST | Send emails |

### File Storage

| Provider | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| AWS S3 | `https://s3.{region}.amazonaws.com/{bucket}` | PUT/GET | File operations |
| Google Cloud | `https://storage.googleapis.com/{bucket}` | PUT/GET | File operations |
| Azure Blob | `https://{account}.blob.core.windows.net/{container}` | PUT/GET | File operations |

### Monitoring Services

| Service | Endpoint | Method | Description |
|---------|----------|--------|-------------|
| Prometheus | `http://prometheus:9090/api/v1/query` | GET | Query metrics |
| Alertmanager | `http://alertmanager:9093/api/v2/alerts` | GET/POST | Alert management |
| Grafana | `http://grafana:3000/api/dashboards` | GET/POST | Dashboard management |
| Jaeger | `http://jaeger:16686/api/traces` | GET | Trace queries |

### Authentication Providers

| Provider | Endpoint | Method | Description |
|----------|----------|--------|-------------|
| Google OAuth | `https://accounts.google.com/o/oauth2/auth` | GET | Authentication |
| Facebook OAuth | `https://www.facebook.com/v12.0/dialog/oauth` | GET | Authentication |
| GitHub OAuth | `https://github.com/login/oauth/authorize` | GET | Authentication |

## Database Configuration

### PostgreSQL Configuration

```sql
-- postgresql.conf settings
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = 'all'
pg_stat_statements.track_utility = on

max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

-- Connection pooling (pgBouncer)
pool_mode = session
max_client_conn = 1000
default_pool_size = 20
reserve_pool_size = 5
```

### Connection Pool Configuration

```javascript
// Database connection pool settings
const poolConfig = {
  // Pool size
  min: 5,
  max: 20,

  // Timeouts
  acquireTimeoutMillis: 60000,
  createTimeoutMillis: 30000,
  destroyTimeoutMillis: 5000,
  idleTimeoutMillis: 600000,

  // Retry settings
  retryDelay: 1000,
  retryCount: 3,

  // Health checks
  healthCheckInterval: 30000,
  propagateCreateError: false
};
```

### Database Indexes

```sql
-- Essential indexes for performance
CREATE INDEX CONCURRENTLY idx_bookings_user_id ON bookings(user_id);
CREATE INDEX CONCURRENTLY idx_bookings_service_id ON bookings(service_id);
CREATE INDEX CONCURRENTLY idx_bookings_created_at ON bookings(created_at DESC);
CREATE INDEX CONCURRENTLY idx_bookings_status ON bookings(status);
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_services_category_id ON services(category_id);
CREATE INDEX CONCURRENTLY idx_payments_booking_id ON payments(booking_id);
```

## Security Configuration

### TLS/SSL Configuration

```nginx
# Nginx SSL configuration
server {
    listen 443 ssl http2;
    server_name api.trixtech.com;

    ssl_certificate /etc/ssl/certs/trixtech.crt;
    ssl_certificate_key /etc/ssl/private/trixtech.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
}
```

### Firewall Rules

```bash
# iptables rules for application server
iptables -A INPUT -p tcp --dport 22 -s trusted-network -j ACCEPT
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -s load-balancer -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -j DROP
```

### Secret Management

```yaml
# Kubernetes secrets
apiVersion: v1
kind: Secret
metadata:
  name: trixtech-secrets
type: Opaque
data:
  jwt-secret: <base64-encoded-secret>
  db-password: <base64-encoded-password>
  api-keys: <base64-encoded-keys>

---
# External secret management (HashiCorp Vault)
path "secret/trixtech/*" {
  capabilities = ["read"]
}

path "database/creds/trixtech" {
  capabilities = ["read"]
}
```

## Monitoring Configuration

### Prometheus Scrape Configuration

```yaml
scrape_configs:
  - job_name: 'trixtech-backend'
    static_configs:
      - targets: ['trixtech-backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  - job_name: 'trixtech-frontend'
    static_configs:
      - targets: ['trixtech-frontend:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    scrape_interval: 30s
```

### Alert Rules

```yaml
groups:
- name: trixtech_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"[5].."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }}% for {{ $labels.service }}"

  - alert: SlowResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Slow response time"
      description: "95th percentile response time is {{ $value }}s"
```

## Performance Configuration

### Application Performance Settings

```javascript
// Performance optimization settings
const performanceConfig = {
  // Caching
  cache: {
    ttl: 3600,        // 1 hour
    maxSize: 1000000  // 1M items
  },

  // Connection pooling
  database: {
    min: 5,
    max: 20,
    idle: 30000
  },

  // Rate limiting
  rateLimit: {
    windowMs: 900000,  // 15 minutes
    max: 100,          // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
  },

  // Compression
  compression: {
    level: 6,
    threshold: 1024
  }
};
```

### Kubernetes Resource Limits

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: resource-limits
  namespace: production
spec:
  limits:
  - type: Container
    default:
      cpu: 500m
      memory: 512Mi
    defaultRequest:
      cpu: 100m
      memory: 256Mi
    max:
      cpu: 2000m
      memory: 2Gi
    min:
      cpu: 50m
      memory: 128Mi
```

### Auto-scaling Configuration

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trixtech-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trixtech-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
    scaleUp:
      stabilizationWindowSeconds: 60
```

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Setup Guides](../setup/)
- [Maintenance Procedures](../maintenance/)
- [Troubleshooting Guides](../troubleshooting/)

---

**Update Procedures:** Review configuration annually. Update thresholds based on performance data quarterly. Audit security settings monthly. Validate integration endpoints with each deployment.