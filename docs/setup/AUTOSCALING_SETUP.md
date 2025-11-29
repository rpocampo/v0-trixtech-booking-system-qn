# Auto-scaling Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Horizontal Pod Autoscaling (HPA)](#horizontal-pod-autoscaling-hpa)
4. [Vertical Pod Autoscaling (VPA)](#vertical-pod-autoscaling-vpa)
5. [Cluster Autoscaling](#cluster-autoscaling)
6. [Custom Metrics Autoscaling](#custom-metrics-autoscaling)
7. [Scaling Policies](#scaling-policies)
8. [Monitoring and Alerts](#monitoring-and-alerts)
9. [Troubleshooting](#troubleshooting)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive instructions for setting up auto-scaling capabilities for the TRIXTECH Booking System. Auto-scaling ensures optimal resource utilization, cost efficiency, and consistent performance by automatically adjusting the number of pods and cluster nodes based on demand patterns and resource usage.

## Prerequisites

- Kubernetes cluster (v1.19+) with Metrics Server installed
- Prometheus and custom metrics adapter (for custom metrics)
- Resource requests and limits defined for all pods
- Monitoring infrastructure (Prometheus/Grafana)
- Cluster autoscaler (for node-level scaling)

### Required Components

1. **Metrics Server**: For CPU/memory-based scaling
   ```bash
   kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
   ```

2. **Prometheus Adapter**: For custom metrics
   ```bash
   helm install prometheus-adapter prometheus-community/prometheus-adapter \
     --namespace monitoring
   ```

3. **Cluster Autoscaler**: For node scaling (cloud-specific)
   ```bash
   # For AWS EKS
   helm install cluster-autoscaler cluster-autoscaler/cluster-autoscaler \
     --namespace kube-system
   ```

## Horizontal Pod Autoscaling (HPA)

### Basic CPU/Memory HPA

Create HPA for the backend service:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trixtech-backend-hpa
  namespace: default
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
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 1
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

Apply the HPA:

```bash
kubectl apply -f trixtech-backend-hpa.yaml
```

### Frontend HPA

Create HPA for the frontend:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trixtech-frontend-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trixtech-frontend
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 200
        periodSeconds: 60
```

## Vertical Pod Autoscaling (VPA)

### VPA Installation

Install VPA components:

```bash
git clone https://github.com/kubernetes/autoscaler.git
cd autoscaler/vertical-pod-autoscaler
./hack/vpa-up.sh
```

### VPA Configuration

Create VPA for backend:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: trixtech-backend-vpa
  namespace: default
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: trixtech-backend
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: "*"
      minAllowed:
        cpu: 100m
        memory: 256Mi
      maxAllowed:
        cpu: 2000m
        memory: 4Gi
      controlledResources: ["cpu", "memory"]
```

### VPA for Database

If running database in Kubernetes:

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: postgres-vpa
  namespace: database
spec:
  targetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: postgres
  updatePolicy:
    updateMode: "Off"  # Manual mode for databases
  resourcePolicy:
    containerPolicies:
    - containerName: postgres
      minAllowed:
        cpu: 500m
        memory: 1Gi
      maxAllowed:
        cpu: 4000m
        memory: 8Gi
```

## Cluster Autoscaling

### AWS EKS Cluster Autoscaler

Configure cluster autoscaler for EKS:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    k8s-addon: cluster-autoscaler.addons.k8s.io
    k8s-app: cluster-autoscaler
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cluster-autoscaler
  labels:
    k8s-addon: cluster-autoscaler.addons.k8s.io
    k8s-app: cluster-autoscaler
rules:
- apiGroups: [""]
  resources: ["events", "endpoints"]
  verbs: ["create", "patch"]
- apiGroups: [""]
  resources: ["pods/eviction"]
  verbs: ["create"]
- apiGroups: [""]
  resources: ["pods/status"]
  verbs: ["update"]
- apiGroups: ["", "events.k8s.io"]
  resources: ["events"]
  verbs: ["create", "patch"]
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["get", "list", "watch", "update", "patch", "delete"]
- apiGroups: [""]
  resources: ["pods", "services", "replicationcontrollers", "persistentvolumeclaims", "persistentvolumes"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["extensions"]
  resources: ["replicasets", "daemonsets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["policy"]
  resources: ["poddisruptionbudgets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["apps"]
  resources: ["statefulsets", "replicasets", "daemonsets"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["storage.k8s.io"]
  resources: ["storageclasses", "csinodes", "csidrivers", "csistoragecapacities"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["batch", "extensions"]
  resources: ["jobs"]
  verbs: ["get", "list", "watch"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  verbs: ["create"]
- apiGroups: ["coordination.k8s.io"]
  resources: ["leases"]
  resourceNames: ["cluster-autoscaler"]
  verbs: ["get", "update"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: cluster-autoscaler
  labels:
    k8s-addon: cluster-autoscaler.addons.k8s.io
    k8s-app: cluster-autoscaler
roleRef:
  apiVersion: rbac.authorization.k8s.io/v1
  kind: ClusterRole
  name: cluster-autoscaler
subjects:
- kind: ServiceAccount
  name: cluster-autoscaler
  namespace: kube-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
  labels:
    app: cluster-autoscaler
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      serviceAccountName: cluster-autoscaler
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.26.2
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/your-cluster-name
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
        resources:
          limits:
            cpu: 100m
            memory: 600Mi
          requests:
            cpu: 100m
            memory: 600Mi
```

### GCP GKE Cluster Autoscaler

For GKE, enable via gcloud:

```bash
gcloud container clusters update your-cluster \
  --enable-autoscaling \
  --min-nodes 1 \
  --max-nodes 10 \
  --zone your-zone
```

## Custom Metrics Autoscaling

### Application-Specific Metrics

Create HPA based on custom application metrics:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: trixtech-backend-custom-hpa
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
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: 100
  - type: Pods
    pods:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: 50
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

### Prometheus Adapter Configuration

Configure custom metrics in prometheus-adapter:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: adapter-config
  namespace: monitoring
data:
  config.yaml: |
    rules:
    - seriesQuery: 'http_requests_total{namespace!="",pod!=""}'
      resources:
        overrides:
          namespace:
            resource: namespace
          pod:
            resource: pod
      name:
        matches: ^(.*)_total$
        as: "${1}_per_second"
      metricsQuery: 'rate(<<.Series>>{<<.LabelMatchers>>}[5m])'
```

## Scaling Policies

### Time-Based Scaling

Create cron-based scaling for predictable traffic patterns:

```yaml
# Scale up during business hours
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-up-business-hours
spec:
  schedule: "0 8 * * 1-5"  # Monday-Friday 8 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - kubectl
            - scale
            - deployment
            - trixtech-backend
            - --replicas=5
          restartPolicy: OnFailure
          serviceAccountName: scaling-sa
---
# Scale down after business hours
apiVersion: batch/v1
kind: CronJob
metadata:
  name: scale-down-after-hours
spec:
  schedule: "0 18 * * 1-5"  # Monday-Friday 6 PM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: kubectl
            image: bitnami/kubectl
            command:
            - kubectl
            - scale
            - deployment
            - trixtech-backend
            - --replicas=2
          restartPolicy: OnFailure
          serviceAccountName: scaling-sa
```

### Event-Based Scaling

Scale based on external events (e.g., marketing campaigns):

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: scaling-config
  namespace: default
data:
  scale-up-replicas: "10"
  scale-down-replicas: "2"
---
apiVersion: batch/v1
kind: Job
metadata:
  name: emergency-scale-up
spec:
  template:
    spec:
      containers:
      - name: kubectl
        image: bitnami/kubectl
        command:
        - sh
        - -c
        - |
          REPLICAS=$(kubectl get configmap scaling-config -o jsonpath='{.data.scale-up-replicas}')
          kubectl scale deployment trixtech-backend --replicas=$REPLICAS
      restartPolicy: OnFailure
      serviceAccountName: scaling-sa
```

## Monitoring and Alerts

### Scaling Metrics

Monitor scaling effectiveness:

```yaml
# Prometheus recording rules
groups:
- name: scaling_metrics
  rules:
  - record: scaling_efficiency
    expr: |
      rate(kube_hpa_status_current_replicas[5m]) /
      rate(kube_hpa_spec_max_replicas[5m])

  - record: resource_waste
    expr: |
      (kube_pod_resource_request - kube_pod_resource_usage) /
      kube_pod_resource_request
```

### Scaling Alerts

Create alerts for scaling issues:

```yaml
groups:
- name: scaling_alerts
  rules:
  - alert: HPANotScaling
    expr: |
      (kube_hpa_status_current_replicas == kube_hpa_spec_min_replicas) and
      (kube_hpa_status_desired_replicas > kube_hpa_spec_min_replicas)
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "HPA not scaling up"
      description: "HPA {{ $labels.horizontalpodautoscaler }} is not scaling despite desired replicas"

  - alert: HPAMaxedOut
    expr: kube_hpa_status_current_replicas == kube_hpa_spec_max_replicas
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "HPA at maximum replicas"
      description: "HPA {{ $labels.horizontalpodautoscaler }} has reached maximum replicas"

  - alert: ClusterAutoscalerStuck
    expr: |
      (time() - cluster_autoscaler_last_activity) > 3600
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Cluster autoscaler inactive"
      description: "Cluster autoscaler has been inactive for over an hour"
```

## Troubleshooting

### Common Issues

#### HPA Not Scaling

**Symptoms:** Desired replicas not matching current replicas

**Solutions:**
1. Check Metrics Server installation and functionality
2. Verify resource requests/limits on pods
3. Check HPA configuration for correct target metrics
4. Ensure metrics are being collected properly

#### Flapping (Oscillating Scaling)

**Symptoms:** Pods constantly scaling up and down

**Solutions:**
1. Increase stabilization window
2. Adjust scaling thresholds
3. Implement cooldown periods
4. Use custom metrics instead of CPU/memory

#### Cluster Autoscaler Not Working

**Symptoms:** Nodes not scaling with pod demands

**Solutions:**
1. Check cloud provider permissions
2. Verify node group configuration
3. Check for pending pods
4. Review cluster autoscaler logs

#### Resource Quotas Exceeded

**Symptoms:** Scaling fails due to resource limits

**Solutions:**
1. Check namespace resource quotas
2. Adjust quota limits if necessary
3. Implement resource management policies
4. Use priority classes for critical workloads

#### Custom Metrics Not Available

**Symptoms:** HPA cannot find custom metrics

**Solutions:**
1. Verify Prometheus adapter installation
2. Check metric names and labels
3. Ensure application is exposing metrics
4. Validate adapter configuration

### Debugging Steps

1. Check HPA status: `kubectl describe hpa trixtech-backend-hpa`
2. View scaling events: `kubectl get events --sort-by=.metadata.creationTimestamp`
3. Check metrics: `kubectl top pods`
4. Review autoscaler logs: `kubectl logs -n kube-system deployment/cluster-autoscaler`
5. Test manual scaling: `kubectl scale deployment trixtech-backend --replicas=5`

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Auto-scaling Troubleshooting](../troubleshooting/AUTOSCALING_TROUBLESHOOTING.md)
- [Monitoring Setup](../setup/MONITORING_SETUP.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review scaling policies quarterly based on traffic patterns. Adjust thresholds based on performance metrics and cost analysis. Test scaling behavior during load testing.