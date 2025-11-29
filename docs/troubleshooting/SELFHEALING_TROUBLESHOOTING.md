# Self-healing Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Health Check Failures](#health-check-failures)
3. [Circuit Breaker Issues](#circuit-breaker-issues)
4. [Pod Restart Problems](#pod-restart-problems)
5. [Automated Recovery Failures](#automated-recovery-failures)
6. [Service Mesh Issues](#service-mesh-issues)
7. [Database Self-healing Problems](#database-self-healing-problems)
8. [Load Balancer Issues](#load-balancer-issues)
9. [Self-healing Monitoring](#self-healing-monitoring)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for self-healing mechanism failures in the TRIXTECH Booking System. It covers health checks, circuit breakers, automated recovery, and service mesh issues with step-by-step resolution procedures.

## Health Check Failures

### Liveness Probe Failures

**Symptoms:** Pods restarting continuously due to failed liveness probes

**Common Causes:**
1. Application not responding to health endpoints
2. Health check configuration incorrect
3. Resource constraints causing timeouts
4. Network issues between kubelet and pod

**Solutions:**

1. **Check Health Endpoint**
   ```bash
   # Test health endpoint directly
   kubectl exec -it <pod-name> -- curl http://localhost:3000/health/live

   # Check application logs during health check
   kubectl logs <pod-name> --previous | grep -i health
   ```

2. **Verify Probe Configuration**
   ```bash
   # Check current probe configuration
   kubectl describe pod <pod-name> | grep -A 10 "Liveness:"

   # Validate probe settings
   kubectl get pod <pod-name> -o yaml | jq '.spec.containers[0].livenessProbe'
   ```

3. **Debug Probe Execution**
   ```bash
   # Manually execute probe command
   kubectl exec <pod-name> -- /bin/sh -c 'curl -f http://localhost:3000/health/live'

   # Check network connectivity
   kubectl exec <pod-name> -- nslookup kubernetes.default.svc.cluster.local
   ```

4. **Adjust Probe Settings**
   ```yaml
   # Fix probe configuration
   livenessProbe:
     httpGet:
       path: /health/live
       port: 3000
     initialDelaySeconds: 30  # Give app more time to start
     periodSeconds: 10
     timeoutSeconds: 5
     failureThreshold: 3
     successThreshold: 1
   ```

### Readiness Probe Issues

**Symptoms:** Pods not receiving traffic due to failed readiness probes

**Common Causes:**
1. Application dependencies not ready
2. Database connections failing
3. External service dependencies down
4. Probe timing too aggressive

**Solutions:**

1. **Check Application Readiness**
   ```bash
   # Test readiness endpoint
   kubectl exec -it <pod-name> -- curl http://localhost:3000/health/ready

   # Check database connectivity
   kubectl exec <pod-name> -- psql -h postgres -U user -d trixtech -c "SELECT 1;"
   ```

2. **Verify Dependencies**
   ```bash
   # Check service dependencies
   kubectl get endpoints <service-name>

   # Test external service connectivity
   kubectl exec <pod-name> -- curl -f https://api.external-service.com/health
   ```

3. **Adjust Readiness Timing**
   ```yaml
   # Increase readiness delays
   readinessProbe:
     httpGet:
       path: /health/ready
       port: 3000
     initialDelaySeconds: 10  # Wait longer for dependencies
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 3
     successThreshold: 2  # Require 2 successes
   ```

### Startup Probe Problems

**Symptoms:** Pods failing to start due to startup probe timeouts

**Common Causes:**
1. Application startup taking too long
2. Startup probe too aggressive
3. Resource constraints during startup
4. Initialization failures

**Solutions:**

1. **Check Startup Logs**
   ```bash
   # Monitor startup process
   kubectl logs <pod-name> -f | head -50

   # Check for startup errors
   kubectl logs <pod-name> --previous | grep -i "error\|fail"
   ```

2. **Adjust Startup Probe**
   ```yaml
   # Configure appropriate startup probe
   startupProbe:
     httpGet:
       path: /health/startup
       port: 3000
     initialDelaySeconds: 10
     periodSeconds: 10
     timeoutSeconds: 5
     failureThreshold: 30  # Allow more time for startup
     successThreshold: 1
   ```

3. **Optimize Application Startup**
   ```javascript
   // Implement proper startup health checks
   app.get('/health/startup', (req, res) => {
     // Check critical dependencies
     const dbConnected = checkDatabaseConnection();
     const cacheConnected = checkCacheConnection();

     if (dbConnected && cacheConnected) {
       res.status(200).json({ status: 'ready' });
     } else {
       res.status(503).json({ status: 'starting' });
     }
   });
   ```

## Circuit Breaker Issues

### Circuit Breaker Not Opening

**Symptoms:** Circuit breaker not activating despite service failures

**Common Causes:**
1. Failure threshold not reached
2. Incorrect failure detection
3. Circuit breaker configuration issues
4. Monitoring/metrics problems

**Solutions:**

1. **Check Circuit Breaker Metrics**
   ```bash
   # Monitor circuit breaker state
   curl -s "http://prometheus:9090/api/v1/query?query=circuit_breaker_state" | jq '.data.result'

   # Check failure counts
   curl -s "http://prometheus:9090/api/v1/query?query=circuit_breaker_failures_total" | jq '.data.result'
   ```

2. **Verify Failure Detection**
   ```javascript
   // Debug circuit breaker logic
   const circuitBreaker = new CircuitBreaker({
     failureThreshold: 5,    // Check threshold
     recoveryTimeout: 30000, // Check timeout
     monitoringPeriod: 10000
   });

   // Add logging
   circuitBreaker.on('open', () => console.log('Circuit breaker opened'));
   circuitBreaker.on('close', () => console.log('Circuit breaker closed'));
   ```

3. **Test Circuit Breaker Manually**
   ```bash
   # Simulate failures
   for i in {1..6}; do
     curl -f http://trixtech-backend:3000/api/failing-endpoint || echo "Request $i failed"
     sleep 1
   done

   # Check circuit breaker state
   curl http://trixtech-backend:3000/circuit-breaker/status
   ```

### Circuit Breaker Not Closing

**Symptoms:** Circuit breaker stuck in open state, blocking all requests

**Common Causes:**
1. Recovery attempts failing
2. Half-open state issues
3. Success threshold too high
4. Service still unhealthy

**Solutions:**

1. **Check Recovery Logic**
   ```javascript
   // Verify half-open behavior
   circuitBreaker.execute(async () => {
     const result = await makeRequest();
     return result;
   }).then(() => {
     console.log('Request succeeded, circuit breaker should close');
   }).catch(() => {
     console.log('Request failed, circuit breaker stays open');
   });
   ```

2. **Adjust Recovery Settings**
   ```javascript
   // Fine-tune recovery parameters
   const circuitBreaker = new CircuitBreaker({
     failureThreshold: 5,
     recoveryTimeout: 60000,     // Increase recovery time
     successThreshold: 2,        // Require fewer successes
     monitoringPeriod: 10000
   });
   ```

3. **Manual Circuit Breaker Reset**
   ```bash
   # Force circuit breaker reset via API
   curl -X POST http://trixtech-backend:3000/admin/circuit-breaker/reset

   # Or restart the service
   kubectl rollout restart deployment trixtech-backend
   ```

### Istio Circuit Breaker Problems

**Symptoms:** Service mesh circuit breaker not working as expected

**Common Causes:**
1. DestinationRule configuration issues
2. Traffic policy conflicts
3. Pilot/Envoy synchronization problems
4. Metrics collection issues

**Solutions:**

1. **Check Istio Configuration**
   ```bash
   # Verify DestinationRule
   kubectl get destinationrule trixtech-backend-circuit-breaker -o yaml

   # Check VirtualService configuration
   kubectl get virtualservice trixtech-backend -o yaml
   ```

2. **Debug Envoy Configuration**
   ```bash
   # Check Envoy config dump
   kubectl exec -it <istio-proxy-pod> -- pilot-agent request GET config_dump | jq '.configs.listeners'

   # Check circuit breaker stats
   kubectl exec -it <istio-proxy-pod> -- pilot-agent request GET stats | grep circuit_breaker
   ```

3. **Test Circuit Breaker Behavior**
   ```bash
   # Generate load to trigger circuit breaker
   for i in {1..100}; do
     curl -f http://trixtech-backend:3000/api/endpoint &
   done

   # Check Istio metrics
   kubectl exec -it <istio-proxy-pod> -- curl http://localhost:15000/stats | grep circuit_breaker
   ```

## Pod Restart Problems

### CrashLoopBackOff Issues

**Symptoms:** Pods continuously crashing and restarting

**Common Causes:**
1. Application crashes
2. Out of memory errors
3. Configuration issues
4. Dependency failures

**Solutions:**

1. **Analyze Crash Logs**
   ```bash
   # Check crash logs
   kubectl logs <pod-name> --previous

   # Check system logs
   kubectl logs <pod-name> --previous | grep -i "error\|exception\|crash"
   ```

2. **Check Resource Limits**
   ```bash
   # Verify resource allocation
   kubectl describe pod <pod-name> | grep -A 5 "Limits:"

   # Check for OOM kills
   kubectl get events --field-selector involvedObject.name=<pod-name> | grep -i oom
   ```

3. **Debug Application Issues**
   ```bash
   # Check application health
   kubectl exec -it <pod-name> -- ps aux | grep node

   # Test application manually
   kubectl exec -it <pod-name> -- node -e "console.log('Node.js working')"
   ```

### Restart Policy Issues

**Symptoms:** Pods not restarting as expected

**Common Causes:**
1. Incorrect restart policy
2. Crash backoff limits
3. Node issues preventing restarts
4. Resource constraints

**Solutions:**

1. **Check Restart Policy**
   ```yaml
   # Verify restart policy
   apiVersion: apps/v1
   kind: Deployment
   spec:
     template:
       spec:
         restartPolicy: Always  # Ensure Always for workloads
   ```

2. **Monitor Restart Events**
   ```bash
   # Check pod restart events
   kubectl describe pod <pod-name> | grep -A 10 "Containers:"

   # Check restart counts
   kubectl get pods | grep <pod-name> | awk '{print $4}'
   ```

3. **Address Backoff Issues**
   ```bash
   # Check backoff status
   kubectl get pods | grep CrashLoopBackOff

   # Reset backoff by deleting pod
   kubectl delete pod <pod-name> --grace-period=0 --force
   ```

## Automated Recovery Failures

### Job Execution Failures

**Symptoms:** Automated recovery jobs failing to execute

**Common Causes:**
1. RBAC permission issues
2. Resource constraints
3. Script errors
4. Timing issues

**Solutions:**

1. **Check Job Status**
   ```bash
   # Check job execution status
   kubectl get jobs -n default

   # Check job logs
   kubectl logs job/<job-name>
   ```

2. **Verify RBAC Permissions**
   ```bash
   # Check service account permissions
   kubectl auth can-i create pods --as=system:serviceaccount:default:recovery-sa

   # Test permissions manually
   kubectl run test --image=busybox --serviceaccount=recovery-sa --rm -it -- sh
   ```

3. **Debug Job Configuration**
   ```yaml
   # Verify job configuration
   apiVersion: batch/v1
   kind: Job
   spec:
     template:
       spec:
         serviceAccountName: recovery-sa
         containers:
         - name: recovery
           image: bitnami/kubectl
           command:
           - /bin/bash
           - -c
           - |
             # Add error handling
             set -e
             echo "Starting recovery..."
             kubectl get pods
             echo "Recovery completed"
   ```

### CronJob Scheduling Issues

**Symptoms:** Scheduled recovery jobs not running

**Common Causes:**
1. Cron expression errors
2. Timezone issues
3. Resource constraints
4. Job concurrency limits

**Solutions:**

1. **Validate Cron Expression**
   ```bash
   # Test cron expression
   echo "*/5 * * * *" | crontab -

   # Check next execution time
   kubectl create job test --from=cronjob/recovery-cronjob
   ```

2. **Check CronJob Status**
   ```bash
   # Check cronjob events
   kubectl describe cronjob recovery-cronjob

   # Check job history
   kubectl get jobs -l job-name=recovery-cronjob
   ```

3. **Debug Scheduling Issues**
   ```bash
   # Check cluster time
   kubectl exec -it <pod> -- date

   # Verify cronjob controller
   kubectl get pods -n kube-system | grep cronjob
   ```

## Service Mesh Issues

### Istio Sidecar Problems

**Symptoms:** Istio sidecars not injecting or malfunctioning

**Common Causes:**
1. Istio injection not enabled
2. Namespace labeling issues
3. Resource constraints
4. Version compatibility

**Solutions:**

1. **Check Injection Status**
   ```bash
   # Verify namespace labeling
   kubectl get namespace default --show-labels

   # Check pod sidecar injection
   kubectl get pods -o json | jq '.items[] | {name: .metadata.name, containers: [.spec.containers[].name]}'
   ```

2. **Enable Istio Injection**
   ```bash
   # Label namespace for injection
   kubectl label namespace default istio-injection=enabled

   # Restart pods to inject sidecars
   kubectl rollout restart deployment
   ```

3. **Debug Sidecar Issues**
   ```bash
   # Check sidecar logs
   kubectl logs <pod-name> -c istio-proxy

   # Check sidecar resource usage
   kubectl top pods | grep istio-proxy
   ```

### Traffic Routing Problems

**Symptoms:** Traffic not routing correctly through service mesh

**Common Causes:**
1. VirtualService configuration errors
2. Gateway issues
3. DestinationRule conflicts
4. Certificate problems

**Solutions:**

1. **Check VirtualService Configuration**
   ```bash
   # Validate VirtualService
   kubectl get virtualservice -o yaml

   # Test routing manually
   kubectl exec -it <source-pod> -- curl http://trixtech-backend.default.svc.cluster.local
   ```

2. **Debug Gateway Issues**
   ```bash
   # Check gateway status
   kubectl get gateway

   # Check gateway logs
   kubectl logs deployment/istio-ingressgateway -n istio-system
   ```

3. **Verify Certificate Configuration**
   ```bash
   # Check certificate status
   kubectl get certificate -n istio-system

   # Test TLS connectivity
   openssl s_client -connect <ingress-host>:443 -servername <ingress-host>
   ```

## Database Self-healing Problems

### PostgreSQL Automatic Failover Issues

**Symptoms:** Database failover not working correctly

**Common Causes:**
1. Patroni configuration issues
2. Network partition problems
3. Resource constraints
4. Synchronization issues

**Solutions:**

1. **Check Patroni Status**
   ```bash
   # Check cluster status
   kubectl exec postgres-0 -- patronictl list

   # Check Patroni logs
   kubectl logs postgres-0 -c patroni
   ```

2. **Verify Replication**
   ```bash
   # Check replication status
   kubectl exec postgres-0 -- psql -c "SELECT * FROM pg_stat_replication;"

   # Test failover manually
   kubectl exec postgres-0 -- patronictl failover
   ```

3. **Debug Network Issues**
   ```bash
   # Check pod connectivity
   kubectl exec postgres-0 -- ping postgres-1.postgres.default.svc.cluster.local

   # Check service endpoints
   kubectl get endpoints postgres
   ```

### Connection Pool Recovery

**Symptoms:** Database connection pool not recovering from failures

**Common Causes:**
1. Pool configuration issues
2. Connection validation problems
3. Resource leaks
4. Network interruptions

**Solutions:**

1. **Check Pool Configuration**
   ```javascript
   // Verify pool settings
   const pool = new Pool({
     host: process.env.DB_HOST,
     port: process.env.DB_PORT,
     database: process.env.DB_NAME,
     user: process.env.DB_USER,
     password: process.env.DB_PASSWORD,
     max: 20,
     min: 5,
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
     acquireTimeoutMillis: 60000,
     // Add connection validation
     allowExitOnIdle: true,
     keepAlive: true
   });
   ```

2. **Implement Connection Recovery**
   ```javascript
   // Add connection event handlers
   pool.on('connect', (client) => {
     console.log('New client connected');
   });

   pool.on('error', (err, client) => {
     console.error('Unexpected error on idle client', err);
     // Force reconnection
     client.release(true);
   });

   pool.on('remove', (client) => {
     console.log('Client removed from pool');
   });
   ```

3. **Test Connection Recovery**
   ```bash
   # Simulate database restart
   kubectl scale deployment postgres --replicas=0
   sleep 30
   kubectl scale deployment postgres --replicas=1

   # Monitor connection recovery
   kubectl logs deployment/trixtech-backend | grep -i "connection\|pool"
   ```

## Load Balancer Issues

### Service Load Balancing Problems

**Symptoms:** Traffic not distributing correctly across pods

**Common Causes:**
1. Service configuration issues
2. Endpoint problems
3. Pod readiness issues
4. Network policy restrictions

**Solutions:**

1. **Check Service Endpoints**
   ```bash
   # Verify service endpoints
   kubectl get endpoints trixtech-backend

   # Check endpoint addresses
   kubectl describe endpoints trixtech-backend
   ```

2. **Verify Pod Readiness**
   ```bash
   # Check pod readiness status
   kubectl get pods -l app=trixtech-backend -o json | jq '.items[] | {name: .metadata.name, ready: .status.conditions[] | select(.type == "Ready") | .status}'

   # Test individual pod responses
   kubectl exec -it <pod-name> -- curl http://localhost:3000/health
   ```

3. **Debug Load Balancing**
   ```bash
   # Test service connectivity
   for i in {1..10}; do
     kubectl run test-$i --image=curlimages/curl --rm -it -- curl -s http://trixtech-backend/health | grep -o '"pod":"[^"]*"' &
   done

   # Check distribution
   kubectl logs deployment/trixtech-backend | grep "Request from" | sort | uniq -c
   ```

### Ingress Load Balancing Issues

**Symptoms:** External traffic not reaching services correctly

**Common Causes:**
1. Ingress configuration errors
2. TLS certificate issues
3. Backend service problems
4. Rate limiting

**Solutions:**

1. **Check Ingress Configuration**
   ```bash
   # Verify ingress rules
   kubectl describe ingress trixtech-ingress

   # Test ingress connectivity
   curl -H "Host: api.trixtech.com" http://<ingress-ip>/
   ```

2. **Debug TLS Issues**
   ```bash
   # Check certificate status
   kubectl get certificate

   # Test TLS handshake
   openssl s_client -connect api.trixtech.com:443 -servername api.trixtech.com
   ```

3. **Verify Backend Health**
   ```bash
   # Check backend service from ingress
   kubectl exec -it <ingress-pod> -- curl http://trixtech-backend.default.svc.cluster.local/health
   ```

## Self-healing Monitoring

### Self-healing Metrics

**Monitor self-healing effectiveness:**

1. **Recovery Time Metrics**
   ```bash
   # Track pod recovery times
   - record: pod_recovery_duration
     expr: time() - kube_pod_created_time_seconds

   # Monitor circuit breaker states
   - record: circuit_breaker_open_total
     expr: circuit_breaker_state{state="open"}
   ```

2. **Failure Recovery Rates**
   ```bash
   # Calculate recovery success rate
   - record: recovery_success_rate
     expr: rate(recovery_operations_total{result="success"}[1h]) / rate(recovery_operations_total[1h])
   ```

### Self-healing Alerts

**Create alerts for self-healing issues:**

```yaml
groups:
- name: self_healing_alerts
  rules:
  - alert: SelfHealingNotWorking
    expr: rate(pod_restart_total[5m]) > 10
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Self-healing may not be working"
      description: "High pod restart rate detected"

  - alert: CircuitBreakerStuck
    expr: circuit_breaker_state{state="open"} and (time() - circuit_breaker_last_state_change) > 3600
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "Circuit breaker stuck in open state"
      description: "Circuit breaker has been open for over an hour"
```

### Self-healing Testing

**Regular testing of self-healing mechanisms:**

1. **Automated Self-healing Tests**
   ```yaml
   apiVersion: batch/v1
   kind: CronJob
   metadata:
     name: self-healing-test
     namespace: default
   spec:
     schedule: "0 2 * * 1"  # Weekly Monday 2 AM
     jobTemplate:
       spec:
         template:
           spec:
             containers:
             - name: self-healing-test
               image: bitnami/kubectl
               command:
               - sh
               - -c
               - |
                 # Test pod restart self-healing
                 kubectl delete pod -l app=trixtech-backend --force
                 sleep 60
                 kubectl wait --for=condition=ready pod -l app=trixtech-backend --timeout=300s

                 # Test circuit breaker
                 # (Add circuit breaker test logic)

                 echo "Self-healing tests completed"
             restartPolicy: OnFailure
   ```

2. **Self-healing Performance Monitoring**
   ```bash
   # Monitor self-healing performance
   - record: self_healing_response_time
     expr: histogram_quantile(0.95, rate(self_healing_operation_duration_seconds_bucket[5m]))

   - record: self_healing_success_rate
     expr: rate(self_healing_operations_total{result="success"}[1h]) / rate(self_healing_operations_total[1h])
   ```

## Related Documentation

- [Self-healing Setup](../setup/SELFHEALING_SETUP.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review self-healing configurations monthly. Test recovery procedures quarterly. Update health check endpoints with application changes. Audit self-healing effectiveness annually.