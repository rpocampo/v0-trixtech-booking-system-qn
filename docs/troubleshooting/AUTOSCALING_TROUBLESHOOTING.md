# Auto-scaling Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Horizontal Pod Autoscaling (HPA) Issues](#horizontal-pod-autoscaling-hpa-issues)
3. [Vertical Pod Autoscaling (VPA) Problems](#vertical-pod-autoscaling-vpa-problems)
4. [Cluster Autoscaling Issues](#cluster-autoscaling-issues)
5. [Custom Metrics Autoscaling Problems](#custom-metrics-autoscaling-problems)
6. [Scaling Policy Issues](#scaling-policy-issues)
7. [Manual Override Procedures](#manual-override-procedures)
8. [Performance Impact Analysis](#performance-impact-analysis)
9. [Scaling Event Analysis](#scaling-event-analysis)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for auto-scaling issues in the TRIXTECH Booking System. It covers HPA, VPA, cluster autoscaling, and custom metrics scaling problems with step-by-step resolution procedures and manual override options.

## Horizontal Pod Autoscaling (HPA) Issues

### HPA Not Scaling

**Symptoms:** Desired replicas don't match current replicas despite high resource usage

**Common Causes:**
1. Metrics server issues
2. Resource request/limits not set
3. Incorrect metric configuration
4. Scaling policies too conservative

**Solutions:**

1. **Check Metrics Server**
   ```bash
   # Verify metrics server is running
   kubectl get deployment metrics-server -n kube-system

   # Check metrics server logs
   kubectl logs deployment/metrics-server -n kube-system

   # Test metrics collection
   kubectl top pods
   kubectl top nodes
   ```

2. **Verify Resource Configuration**
   ```bash
   # Check pod resource requests/limits
   kubectl describe pod <pod-name> | grep -A 10 "Requests:"

   # Ensure resources are properly configured
   kubectl get pods -o jsonpath='{.spec.containers[*].resources}' | jq .
   ```

3. **Debug HPA Configuration**
   ```bash
   # Check HPA status
   kubectl describe hpa trixtech-backend-hpa

   # Get HPA events
   kubectl get events --field-selector involvedObject.name=trixtech-backend-hpa

   # Check current metrics
   kubectl get hpa trixtech-backend-hpa -o yaml
   ```

4. **Test Scaling Manually**
   ```bash
   # Manually scale to test
   kubectl scale deployment trixtech-backend --replicas=5

   # Check if scaling works
   kubectl get pods -l app=trixtech-backend
   ```

### HPA Scaling Too Aggressively

**Symptoms:** Pods scaling up/down too frequently, causing instability

**Common Causes:**
1. Stabilization window too short
2. Thresholds too sensitive
3. Flapping metrics
4. Insufficient cooldown periods

**Solutions:**

1. **Adjust Stabilization Window**
   ```yaml
   # Increase stabilization window
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   metadata:
     name: trixtech-backend-hpa
   spec:
     behavior:
       scaleDown:
         stabilizationWindowSeconds: 300  # 5 minutes
       scaleUp:
         stabilizationWindowSeconds: 60   # 1 minute
   ```

2. **Tune Scaling Policies**
   ```yaml
   # Implement more conservative scaling
   behavior:
     scaleDown:
       policies:
       - type: Percent
         value: 20  # Scale down by 20% max
         periodSeconds: 60
       - type: Pods
         value: 1   # Or 1 pod max
         periodSeconds: 60
       selectPolicy: Min
     scaleUp:
       policies:
       - type: Percent
         value: 100  # Scale up by 100% max
         periodSeconds: 60
       - type: Pods
         value: 3    # Or 3 pods max
         periodSeconds: 60
       selectPolicy: Max
   ```

3. **Use Smoothing Algorithms**
   ```yaml
   # Use average instead of instant values
   metrics:
   - type: Resource
     resource:
       name: cpu
       target:
         type: Utilization
         averageUtilization: 70
   ```

### HPA Stuck at Max/Min Replicas

**Symptoms:** HPA reaches max replicas and stays there, or won't scale above min

**Common Causes:**
1. Max replicas too low
2. Min replicas too high
3. Resource limits preventing scaling
4. Cluster capacity issues

**Solutions:**

1. **Adjust Replica Limits**
   ```yaml
   # Increase max replicas
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaling
   metadata:
     name: trixtech-backend-hpa
   spec:
     minReplicas: 2
     maxReplicas: 20  # Increased from 10
   ```

2. **Check Cluster Capacity**
   ```bash
   # Check node capacity
   kubectl describe nodes | grep -A 10 "Capacity:"

   # Check available resources
   kubectl get nodes -o json | jq '.items[].status.allocatable'

   # Check for resource constraints
   kubectl get pods -o json | jq 'select(.status.phase=="Pending") | .status.conditions[] | select(.reason=="Unschedulable") | .message'
   ```

3. **Review Resource Limits**
   ```bash
   # Check if pod limits are too high
   kubectl get pods -o jsonpath='{.items[*].spec.containers[*].resources.limits}' | jq .

   # Calculate total resource requirements
   kubectl get hpa -o json | jq '.items[] | {name: .metadata.name, desired: .status.desiredReplicas, max: .spec.maxReplicas}'
   ```

## Vertical Pod Autoscaling (VPA) Problems

### VPA Not Adjusting Resources

**Symptoms:** Pod resource requests not updating despite VPA recommendations

**Common Causes:**
1. VPA in "Off" mode
2. Pod restart required for updates
3. Resource policy constraints
4. VPA controller issues

**Solutions:**

1. **Check VPA Mode**
   ```bash
   # Check VPA configuration
   kubectl describe vpa trixtech-backend-vpa

   # Verify update mode
   kubectl get vpa trixtech-backend-vpa -o jsonpath='{.spec.updatePolicy.updateMode}'
   ```

2. **Apply VPA Recommendations**
   ```bash
   # Get VPA recommendations
   kubectl describe vpa trixtech-backend-vpa | grep -A 10 "Recommendation"

   # Manually apply recommendations
   kubectl patch deployment trixtech-backend --type='json' -p='[
     {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/cpu", "value": "200m"},
     {"op": "replace", "path": "/spec/template/spec/containers/0/resources/requests/memory", "value": "256Mi"}
   ]'
   ```

3. **Force Pod Restart**
   ```bash
   # Restart pods to apply new resource requests
   kubectl rollout restart deployment trixtech-backend

   # Check if resources updated
   kubectl describe pod <new-pod-name> | grep -A 5 "Requests:"
   ```

### VPA Over-Provisioning

**Symptoms:** VPA setting resource requests too high, wasting resources

**Common Causes:**
1. Peak usage captured as normal
2. Insufficient observation period
3. Incorrect percentile configuration
4. Application startup spikes

**Solutions:**

1. **Adjust VPA Configuration**
   ```yaml
   # Configure resource policies
   apiVersion: autoscaling.k8s.io/v1
   kind: VerticalPodAutoscaler
   spec:
     resourcePolicy:
       containerPolicies:
       - containerName: "*"
         minAllowed:
           cpu: 100m
           memory: 128Mi
         maxAllowed:
           cpu: 1000m
           memory: 1Gi
         controlledResources: ["cpu", "memory"]
   ```

2. **Use Different Percentiles**
   ```yaml
   # Use 90th percentile instead of 95th
   # This requires VPA recommender configuration
   recommender:
     recommendationMarginFraction: 0.1
     targetCpuPercentile: 0.9
     targetMemoryPercentile: 0.9
   ```

3. **Exclude Startup Resources**
   ```yaml
   # Use VPA with admission controller
   # Configure to ignore initial resource spikes
   admissionController:
     enabled: true
   ```

## Cluster Autoscaling Issues

### Cluster Not Scaling Nodes

**Symptoms:** Pods pending due to insufficient cluster capacity, but no new nodes added

**Common Causes:**
1. Cluster autoscaler not running
2. Insufficient permissions
3. Node group constraints
4. Scaling policies too restrictive

**Solutions:**

1. **Check Cluster Autoscaler Status**
   ```bash
   # Verify autoscaler deployment
   kubectl get deployment cluster-autoscaler -n kube-system

   # Check autoscaler logs
   kubectl logs deployment/cluster-autoscaler -n kube-system --tail=50

   # Check for scaling events
   kubectl get events --field-selector source=cluster-autoscaler
   ```

2. **Verify AWS Permissions (for EKS)**
   ```bash
   # Check IAM permissions
   aws iam simulate-principal-policy \
     --policy-source-arn arn:aws:iam::account:role/cluster-autoscaler \
     --action-names autoscaling:DescribeAutoScalingGroups \
     --action-names autoscaling:DescribeLaunchConfigurations \
     --action-names ec2:DescribeInstanceTypes

   # Check ASG tags
   aws autoscaling describe-auto-scaling-groups \
     --filters Name=tag:k8s.io/cluster-autoscaler/enabled,Values=true
   ```

3. **Review Node Group Configuration**
   ```bash
   # Check node group settings
   aws eks describe-nodegroup --cluster-name your-cluster --nodegroup-name your-nodegroup

   # Verify instance types and zones
   aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names your-asg
   ```

### Nodes Scaling But Not Joining Cluster

**Symptoms:** New nodes created but not joining Kubernetes cluster

**Common Causes:**
1. Node bootstrap issues
2. Security group problems
3. IAM role issues
4. kubelet configuration errors

**Solutions:**

1. **Check Node Bootstrap Logs**
   ```bash
   # Check cloud-init logs (AWS)
   aws ec2 get-console-output --instance-id i-1234567890abcdef0

   # Check kubelet status on node
   kubectl debug node/<node-name> -it --image=busybox -- chroot /host systemctl status kubelet
   ```

2. **Verify Networking**
   ```bash
   # Check security groups
   aws ec2 describe-security-groups --group-ids sg-12345678

   # Test connectivity to API server
   kubectl debug node/<node-name> -it --image=busybox -- nc -zv <api-server-endpoint> 443
   ```

3. **Check IAM Permissions**
   ```bash
   # Verify node IAM role
   aws ec2 describe-instances --instance-ids i-1234567890abcdef0 --query 'Reservations[].Instances[].IamInstanceProfile'
   ```

### Cluster Scaling Too Slowly

**Symptoms:** Scaling takes too long to respond to load changes

**Common Causes:**
1. Scale-up cooldown too long
2. Insufficient node capacity
3. Resource checking delays
4. Autoscaler configuration

**Solutions:**

1. **Adjust Autoscaler Settings**
   ```bash
   # Modify cluster autoscaler flags
   spec:
     containers:
     - name: cluster-autoscaler
       command:
       - ./cluster-autoscaler
       - --scale-up-delay-after-add=1m  # Faster scale-up
       - --scale-up-delay-after-delete=1m
       - --scale-up-delay-after-failure=1m
       - --scan-interval=10s  # More frequent checks
   ```

2. **Pre-warm Node Groups**
   ```bash
   # Configure minimum nodes
   aws autoscaling update-auto-scaling-group \
     --auto-scaling-group-name your-asg \
     --min-size 3  # Keep minimum nodes ready
   ```

3. **Use Multiple Node Groups**
   ```bash
   # Create node groups for different workloads
   aws eks create-nodegroup \
     --cluster-name your-cluster \
     --nodegroup-name cpu-intensive \
     --instance-types c5.large \
     --min-size 0 \
     --max-size 10
   ```

## Custom Metrics Autoscaling Problems

### Custom Metrics Not Available

**Symptoms:** HPA cannot find custom metrics for scaling decisions

**Common Causes:**
1. Metrics adapter not configured
2. Application not exposing metrics
3. Metric collection failures
4. Label mismatches

**Solutions:**

1. **Check Metrics Adapter**
   ```bash
   # Verify prometheus adapter
   kubectl get deployment prometheus-adapter -n monitoring

   # Check adapter logs
   kubectl logs deployment/prometheus-adapter -n monitoring

   # Test custom metrics API
   kubectl get --raw "/apis/custom.metrics.k8s.io/v1beta1" | jq .
   ```

2. **Verify Application Metrics**
   ```bash
   # Check application metrics endpoint
   curl http://trixtech-backend:3000/metrics | grep http_requests_per_second

   # Verify metrics in Prometheus
   curl "http://prometheus:9090/api/v1/query?query=http_requests_per_second"
   ```

3. **Debug Metric Collection**
   ```yaml
   # Check HPA custom metrics configuration
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   spec:
     metrics:
     - type: Pods
       pods:
         metric:
           name: http_requests_per_second
         target:
           type: AverageValue
           averageValue: 100
   ```

### Custom Metrics Inaccurate

**Symptoms:** Scaling based on incorrect or stale metric values

**Common Causes:**
1. Metric calculation errors
2. Collection delays
3. Metric aggregation issues
4. Application bugs

**Solutions:**

1. **Validate Metric Calculations**
   ```bash
   # Check raw metric values
   curl "http://prometheus:9090/api/v1/query?query=http_requests_total"

   # Verify rate calculations
   curl "http://prometheus:9090/api/v1/query?query=rate(http_requests_total[5m])"
   ```

2. **Check Collection Timing**
   ```bash
   # Verify scrape intervals
   curl "http://prometheus:9090/api/v1/targets" | jq '.data.activeTargets[] | select(.labels.app == "trixtech-backend") | .lastScrape'

   # Check metric timestamps
   curl "http://prometheus:9090/api/v1/query?query=http_requests_per_second" | jq '.data.result[0].value[0]'
   ```

3. **Debug Application Metrics**
   ```javascript
   // Verify metric emission
   const end = histogram.startTimer();
   // ... request processing ...
   end({ method: req.method, route: req.route.path, status_code: res.statusCode });

   // Check metric registry
   console.log(register.getMetricsAsJSON());
   ```

## Scaling Policy Issues

### Policies Not Taking Effect

**Symptoms:** Scaling policies configured but not being applied

**Common Causes:**
1. Syntax errors in policy configuration
2. Unsupported policy types
3. Version compatibility issues
4. Controller bugs

**Solutions:**

1. **Validate Policy Syntax**
   ```yaml
   # Check behavior configuration
   apiVersion: autoscaling/v2
   kind: HorizontalPodAutoscaler
   spec:
     behavior:
       scaleDown:
         stabilizationWindowSeconds: 300
         policies:
         - type: Percent
           value: 50
           periodSeconds: 60
         selectPolicy: Min
   ```

2. **Check Kubernetes Version**
   ```bash
   # Verify HPA API version support
   kubectl api-versions | grep autoscaling

   # Check cluster version
   kubectl version --short
   ```

3. **Test Policy Application**
   ```bash
   # Manually trigger scaling to test policies
   kubectl scale deployment trixtech-backend --replicas=10

   # Monitor scaling behavior
   kubectl get hpa trixtech-backend-hpa -w
   ```

### Conflicting Policies

**Symptoms:** Multiple scaling policies interfering with each other

**Common Causes:**
1. HPA and VPA both active
2. Multiple HPAs on same deployment
3. Cluster autoscaler conflicts
4. Manual scaling overrides

**Solutions:**

1. **Choose Appropriate Autoscalers**
   ```yaml
   # Use HPA for horizontal scaling
   # Use VPA for vertical scaling
   # Don't use both simultaneously on same resources
   ```

2. **Avoid Multiple HPAs**
   ```bash
   # Check for conflicting HPAs
   kubectl get hpa --all-namespaces

   # Remove duplicate HPAs
   kubectl delete hpa conflicting-hpa
   ```

3. **Coordinate Scaling Types**
   ```bash
   # Set VPA to Off mode if using HPA
   apiVersion: autoscaling.k8s.io/v1
   kind: VerticalPodAutoscaler
   spec:
     updatePolicy:
       updateMode: "Off"  # Manual mode
   ```

## Manual Override Procedures

### Emergency Scaling

**Situation:** Auto-scaling not responding fast enough to critical situations

**Override Steps:**

1. **Immediate Scale-Up**
   ```bash
   # Emergency scale to maximum
   kubectl scale deployment trixtech-backend --replicas=20

   # Scale node group if needed
   aws autoscaling update-auto-scaling-group \
     --auto-scaling-group-name your-asg \
     --min-size 5 \
     --max-size 20 \
     --desired-capacity 10
   ```

2. **Disable Autoscaling Temporarily**
   ```bash
   # Pause HPA
   kubectl annotate hpa trixtech-backend-hpa cluster-autoscaler.kubernetes.io/safe-to-evict=false

   # Set manual replica count
   kubectl scale deployment trixtech-backend --replicas=15
   ```

3. **Monitor and Restore**
   ```bash
   # Monitor manual scaling effects
   kubectl get pods -l app=trixtech-backend -w

   # Restore autoscaling when stable
   kubectl annotate hpa trixtech-backend-hpa cluster-autoscaler.kubernetes.io/safe-to-evict-
   ```

### Scale-Down Overrides

**Situation:** Need to reduce capacity immediately despite autoscaler recommendations

1. **Force Scale-Down**
   ```bash
   # Override HPA recommendations
   kubectl scale deployment trixtech-backend --replicas=3

   # Temporarily adjust HPA limits
   kubectl patch hpa trixtech-backend-hpa --type='json' -p='[
     {"op": "replace", "path": "/spec/minReplicas", "value": 3}
   ]'
   ```

2. **Gradual Reduction**
   ```bash
   # Scale down in steps
   for replicas in 10 8 6 4 3; do
     kubectl scale deployment trixtech-backend --replicas=$replicas
     sleep 300  # Wait 5 minutes between steps
   done
   ```

### Cluster-Level Overrides

**Situation:** Need to control entire cluster scaling

1. **Pause Cluster Autoscaler**
   ```bash
   # Suspend autoscaling
   aws autoscaling suspend-processes --auto-scaling-group-name your-asg --scaling-processes Launch Terminate

   # Manually adjust capacity
   aws autoscaling set-desired-capacity --auto-scaling-group-name your-asg --desired-capacity 8
   ```

2. **Resume Autoscaling**
   ```bash
   # Resume normal autoscaling
   aws autoscaling resume-processes --auto-scaling-group-name your-asg --scaling-processes Launch Terminate
   ```

## Performance Impact Analysis

### Scaling Performance Metrics

**Monitor scaling effectiveness:**

1. **Scale-Up Time**
   ```bash
   # Measure time to scale from 3 to 10 replicas
   START_TIME=$(date +%s)
   kubectl scale deployment trixtech-backend --replicas=10
   kubectl wait --for=condition=ready pod -l app=trixtech-backend --timeout=300s
   END_TIME=$(date +%s)
   echo "Scale-up time: $((END_TIME - START_TIME)) seconds"
   ```

2. **Resource Efficiency**
   ```bash
   # Calculate scaling efficiency
   kubectl get hpa -o json | jq '
     .items[] | {
       name: .metadata.name,
       current: .status.currentReplicas,
       desired: .status.desiredReplicas,
       efficiency: (if .status.desiredReplicas > 0 then (.status.currentReplicas / .status.desiredReplicas) else 0 end)
     }
   '
   ```

3. **Cost Impact**
   ```bash
   # Estimate scaling costs
   kubectl get pods -o json | jq '
     .items[] | select(.metadata.labels.app == "trixtech-backend") | {
       name: .metadata.name,
       cpu_request: .spec.containers[0].resources.requests.cpu,
       memory_request: .spec.containers[0].resources.requests.memory
     }
   '
   ```

### Scaling Threshold Optimization

**Analyze and optimize scaling thresholds:**

1. **Historical Analysis**
   ```bash
   # Analyze past scaling events
   kubectl get events --field-selector reason=SuccessfulRescale -o json | jq '
     .items[] | {
       time: .lastTimestamp,
       message: .message,
       reason: .reason
     }
   ' | head -20
   ```

2. **Threshold Tuning**
   ```bash
   # Calculate optimal thresholds based on historical data
   # Use Prometheus to analyze metric patterns
   curl "http://prometheus:9090/api/v1/query_range?query=cpu_usage&start=$(date -d '7 days ago' +%s)&end=$(date +%s)&step=3600" | jq '
     .data.result[0].values | map(.[1] | tonumber) | {
       avg: (add / length),
       p50: sort | .[length * 0.5 | floor],
       p90: sort | .[length * 0.9 | floor],
       p95: sort | .[length * 0.95 | floor],
       recommended_threshold: (sort | .[length * 0.8 | floor])  # 80th percentile
     }
   '
   ```

## Scaling Event Analysis

### Scaling Event Logging

**Track and analyze scaling events:**

1. **HPA Event Monitoring**
   ```bash
   # Monitor HPA scaling events
   kubectl get events --field-selector reason=SuccessfulRescale,FailedRescale -w

   # Log scaling decisions
   kubectl describe hpa | grep -A 10 "Events:"
   ```

2. **Cluster Autoscaler Events**
   ```bash
   # Check cluster autoscaler events
   kubectl logs deployment/cluster-autoscaler -n kube-system | grep -i scale

   # AWS autoscaling events
   aws autoscaling describe-scaling-activities --auto-scaling-group-name your-asg
   ```

### Scaling Pattern Analysis

**Identify scaling patterns and issues:**

1. **Flapping Detection**
   ```bash
   # Detect scaling oscillations
   kubectl get events --field-selector reason=SuccessfulRescale --since=24h | \
     awk '{print $1, $2}' | sort | uniq -c | sort -nr | head -10
   ```

2. **Inefficient Scaling**
   ```bash
   # Identify over-scaling
   kubectl get hpa -o json | jq '
     .items[] | select(.status.desiredReplicas > .status.currentReplicas * 1.5) | {
       name: .metadata.name,
       current: .status.currentReplicas,
       desired: .status.desiredReplicas,
       ratio: (.status.desiredReplicas / .status.currentReplicas)
     }
   '
   ```

3. **Scaling Lag Analysis**
   ```bash
   # Measure scaling response time
   # Compare metric spikes with scaling events
   curl "http://prometheus:9090/api/v1/query_range?query=cpu_usage > 80&start=$(date -d '1 hour ago' +%s)&end=$(date +%s)&step=60"
   ```

### Scaling Improvement Recommendations

**Based on analysis, implement improvements:**

1. **Threshold Adjustments**
   ```yaml
   # Adjust based on analysis
   metrics:
   - type: Resource
     resource:
       name: cpu
       target:
         type: Utilization
         averageUtilization: 75  # Adjusted from 70
   ```

2. **Policy Refinements**
   ```yaml
   # Implement more sophisticated policies
   behavior:
     scaleUp:
       stabilizationWindowSeconds: 120
       policies:
       - type: Percent
         value: 50
         periodSeconds: 60
       - type: Pods
         value: 2
         periodSeconds: 60
       selectPolicy: Max
   ```

3. **Monitoring Enhancements**
   ```yaml
   # Add scaling-specific metrics
   - record: scaling_efficiency
     expr: kube_hpa_status_current_replicas / kube_hpa_status_desired_replicas

   - record: scaling_latency
     expr: time() - kube_hpa_status_last_scale_time
   ```

## Related Documentation

- [Auto-scaling Setup](../setup/AUTOSCALING_SETUP.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Performance Setup](../setup/PERFORMANCE_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review scaling configurations monthly. Analyze scaling events weekly. Update thresholds based on performance data quarterly. Test scaling behaviors during load testing.