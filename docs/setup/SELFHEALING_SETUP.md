# Self-healing Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Health Checks and Probes](#health-checks-and-probes)
4. [Pod Disruption Budgets](#pod-disruption-budgets)
5. [Circuit Breaker Pattern](#circuit-breaker-pattern)
6. [Automated Recovery Procedures](#automated-recovery-procedures)
7. [Self-healing for Databases](#self-healing-for-databases)
8. [Monitoring Self-healing](#monitoring-self-healing)
9. [Troubleshooting](#troubleshooting)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for implementing self-healing mechanisms in the TRIXTECH Booking System. Self-healing ensures system resilience by automatically detecting failures, isolating problems, and initiating recovery procedures without manual intervention.

## Prerequisites

- Kubernetes cluster (v1.19+)
- Monitoring infrastructure (Prometheus/Grafana)
- Alerting system (Alertmanager)
- Service mesh (Istio/Linkerd) - optional but recommended
- Backup and recovery systems

### Required Components

1. **Metrics Server**: For resource monitoring
2. **Prometheus**: For health metrics collection
3. **Alertmanager**: For automated responses
4. **Service Mesh**: For traffic management and circuit breaking

## Health Checks and Probes

### Liveness Probes

Configure liveness probes for backend:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-backend
  namespace: default
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
        image: trixtech/backend:latest
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
          successThreshold: 1
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
          successThreshold: 1
        startupProbe:
          httpGet:
            path: /health/startup
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 30
          successThreshold: 1
```

### Readiness Probes

Configure readiness probes for frontend:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-frontend
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: trixtech-frontend
  template:
    metadata:
      labels:
        app: trixtech-frontend
    spec:
      containers:
      - name: frontend
        image: trixtech/frontend:latest
        ports:
        - containerPort: 3000
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        livenessProbe:
          httpGet:
            path: /
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 10
```

### Database Health Checks

For PostgreSQL StatefulSet:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: database
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: trixtech
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - exec pg_isready -U postgres -h 127.0.0.1 -p 5432
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 6
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - exec pg_isready -U postgres -h 127.0.0.1 -p 5432
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
```

## Pod Disruption Budgets

### Backend PDB

Ensure minimum availability during disruptions:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: trixtech-backend-pdb
  namespace: default
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: trixtech-backend
```

### Frontend PDB

Allow more flexibility for frontend:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: trixtech-frontend-pdb
  namespace: default
spec:
  maxUnavailable: 50%
  selector:
    matchLabels:
      app: trixtech-frontend
```

### Database PDB

Critical PDB for database:

```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: postgres-pdb
  namespace: database
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: postgres
```

## Circuit Breaker Pattern

### Istio Circuit Breaker

Install Istio if not already installed:

```bash
# Install Istio
curl -L https://istio.io/downloadIstio | sh -
cd istio-*
export PATH=$PWD/bin:$PATH

# Install with demo profile
istioctl install --set profile=demo -y
```

Configure circuit breaker for backend:

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: trixtech-backend-circuit-breaker
  namespace: default
spec:
  host: trixtech-backend.default.svc.cluster.local
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 10
        maxRetries: 3
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
```

### Application-Level Circuit Breaker

Implement circuit breaker in Node.js backend:

```javascript
// backend/utils/circuitBreaker.js
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = 'CLOSED';
      }
    }
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  getState() {
    return this.state;
  }
}

module.exports = CircuitBreaker;
```

Use circuit breaker for external API calls:

```javascript
// backend/services/paymentService.js
const CircuitBreaker = require('../utils/circuitBreaker');

const paymentCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeout: 30000
});

class PaymentService {
  async processPayment(paymentData) {
    return paymentCircuitBreaker.execute(async () => {
      // Payment processing logic
      const response = await axios.post('https://api.payment-gateway.com/process', paymentData);
      return response.data;
    });
  }
}
```

## Automated Recovery Procedures

### Pod Restart Policies

Configure restart policies:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-backend
spec:
  template:
    spec:
      restartPolicy: Always
      containers:
      - name: backend
        # ... other config
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Automated Rollback

Create automated rollback job:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: rollback-job
  namespace: default
spec:
  template:
    spec:
      serviceAccountName: rollback-sa
      containers:
      - name: kubectl
        image: bitnami/kubectl
        command:
        - sh
        - -c
        - |
          # Check if deployment is healthy
          if ! kubectl rollout status deployment/trixtech-backend --timeout=300s; then
            echo "Deployment failed, rolling back..."
            kubectl rollout undo deployment/trixtech-backend
            kubectl rollout status deployment/trixtech-backend --timeout=300s
          fi
      restartPolicy: Never
```

### Self-healing CronJobs

Create periodic health checks:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: health-check-cron
  namespace: default
spec:
  schedule: "*/5 * * * *"  # Every 5 minutes
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: health-check
            image: curlimages/curl
            command:
            - sh
            - -c
            - |
              # Check backend health
              if ! curl -f http://trixtech-backend:3000/health; then
                echo "Backend unhealthy, triggering restart"
                kubectl delete pod -l app=trixtech-backend --force
              fi

              # Check database connectivity
              if ! nc -z postgres.database.svc.cluster.local 5432; then
                echo "Database unreachable, checking pods"
                kubectl get pods -n database
              fi
          restartPolicy: OnFailure
          serviceAccountName: health-check-sa
```

## Self-healing for Databases

### PostgreSQL Automatic Failover

For PostgreSQL with Patroni:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-cluster
  namespace: database
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
      cluster: trixtech
  template:
    metadata:
      labels:
        app: postgres
        cluster: trixtech
    spec:
      containers:
      - name: postgres
        image: patroni/postgres
        env:
        - name: PATRONI_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: PATRONI_KUBERNETES_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        - name: PATRONI_KUBERNETES_LABELS
          value: "{app: postgres, cluster: trixtech}"
        - name: PATRONI_SCOPE
          value: trixtech-cluster
        ports:
        - containerPort: 5432
        - containerPort: 8008
        livenessProbe:
          httpGet:
            path: /health
            port: 8008
          initialDelaySeconds: 30
          periodSeconds: 10
```

### Database Connection Pooling

Implement connection pooling with automatic recovery:

```javascript
// backend/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  retryOnExit: true,
  retryDelay: 1000,
  maxRetries: 5
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Attempt to reconnect
  setTimeout(() => {
    pool.connect((err, client, done) => {
      if (err) {
        console.error('Failed to reconnect to database', err);
      } else {
        console.log('Successfully reconnected to database');
        done();
      }
    });
  }, 5000);
});

module.exports = pool;
```

## Monitoring Self-healing

### Self-healing Metrics

Track self-healing effectiveness:

```yaml
# Prometheus metrics for self-healing
groups:
- name: self_healing_metrics
  rules:
  - record: pod_restart_rate
    expr: rate(kube_pod_container_status_restarts_total[5m])

  - record: circuit_breaker_state
    expr: circuit_breaker_state{state="open"}

  - record: health_check_failures
    expr: rate(health_check_failures_total[5m])
```

### Self-healing Alerts

Create alerts for self-healing issues:

```yaml
groups:
- name: self_healing_alerts
  rules:
  - alert: HighPodRestartRate
    expr: rate(kube_pod_container_status_restarts_total[10m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High pod restart rate"
      description: "Pods are restarting frequently, check self-healing mechanisms"

  - alert: CircuitBreakerOpen
    expr: circuit_breaker_state{state="open"} == 1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "Circuit breaker is open"
      description: "Circuit breaker for {{ $labels.service }} is open"

  - alert: HealthCheckFailing
    expr: health_check_status == 0
    for: 3m
    labels:
      severity: critical
    annotations:
      summary: "Health check failing"
      description: "Health check for {{ $labels.service }} is failing"

  - alert: PDBViolation
    expr: kube_poddisruptionbudget_status_disruptions_allowed < 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Pod disruption budget violation"
      description: "Pod disruption budget for {{ $labels.poddisruptionbudget }} is violated"
```

## Troubleshooting

### Common Issues

#### Probes Failing

**Symptoms:** Pods restarting due to failed liveness probes

**Solutions:**
1. Check probe endpoints are accessible
2. Verify probe paths and ports
3. Adjust timeout and threshold values
4. Check application logs for probe failures

#### Circuit Breaker Not Working

**Symptoms:** Service calls not being blocked when unhealthy

**Solutions:**
1. Verify circuit breaker configuration
2. Check metrics collection
3. Test circuit breaker logic manually
4. Review error handling in application code

#### PDB Preventing Updates

**Symptoms:** Deployments stuck due to PDB constraints

**Solutions:**
1. Check current pod status
2. Temporarily adjust PDB settings
3. Use rollout restart with care
4. Implement proper update strategies

#### Database Connection Issues

**Symptoms:** Application unable to connect to database

**Solutions:**
1. Check database pod status
2. Verify connection string and credentials
3. Test database connectivity manually
4. Check connection pool configuration

#### Automated Recovery Failing

**Symptoms:** Systems not recovering automatically

**Solutions:**
1. Check cron job execution
2. Verify service account permissions
3. Review recovery script logic
4. Test recovery procedures manually

### Debugging Steps

1. Check pod events: `kubectl describe pod <pod-name>`
2. View probe status: `kubectl get pods -o wide`
3. Check circuit breaker metrics: `kubectl logs -l app=circuit-breaker`
4. Review PDB status: `kubectl get pdb`
5. Test health endpoints manually: `curl http://service/health`

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Self-healing Troubleshooting](../troubleshooting/SELFHEALING_TROUBLESHOOTING.md)
- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review self-healing configurations quarterly. Test recovery procedures during maintenance windows. Update circuit breaker thresholds based on traffic patterns and failure rates.