# Quick Start Automation Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Basic Setup Checklist](#basic-setup-checklist)
4. [Getting Started with CI/CD](#getting-started-with-cicd)
5. [Monitoring Quick Setup](#monitoring-quick-setup)
6. [Backup Automation Basics](#backup-automation-basics)
7. [Security Automation Start](#security-automation-start)
8. [Common First Steps](#common-first-steps)
9. [Troubleshooting Common Issues](#troubleshooting-common-issues)
10. [Next Steps](#next-steps)

## Introduction

This guide provides a quick start for implementing automation in the TRIXTECH Booking System. It focuses on the essential steps to get basic automation running quickly, with links to detailed documentation for advanced configuration.

## Prerequisites

### System Requirements
- Kubernetes cluster (v1.19+) or Docker environment
- Git repository with CI/CD capabilities
- Basic understanding of containerization
- Administrative access to target environments

### Required Tools
- `kubectl` for Kubernetes operations
- `docker` for container operations
- `git` for version control
- Text editor or IDE
- Terminal/command line access

### Knowledge Prerequisites
- Basic Linux/Unix commands
- Understanding of web applications
- Familiarity with Git workflows
- Basic networking concepts

## Basic Setup Checklist

### 1. Repository Setup
- [ ] Fork or clone the TRIXTECH repository
- [ ] Set up GitHub repository with Actions enabled
- [ ] Configure repository secrets for deployments
- [ ] Set up branch protection rules

### 2. Environment Preparation
- [ ] Set up staging environment
- [ ] Configure production environment
- [ ] Set up domain names and DNS
- [ ] Configure SSL certificates

### 3. Basic Infrastructure
- [ ] Deploy Kubernetes cluster or container runtime
- [ ] Set up container registry (Docker Hub, ECR, etc.)
- [ ] Configure networking and load balancers
- [ ] Set up basic monitoring

### 4. Application Deployment
- [ ] Build and deploy application containers
- [ ] Configure environment variables
- [ ] Set up database connections
- [ ] Verify application functionality

## Getting Started with CI/CD

### Step 1: Enable GitHub Actions

1. Go to your repository on GitHub
2. Click "Settings" tab
3. Click "Actions" in the left sidebar
4. Select "Allow all actions and reusable workflows"
5. Enable "Read and write permissions" for GITHUB_TOKEN

### Step 2: Create Basic CI Pipeline

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Run tests
      run: npm test

    - name: Build application
      run: npm run build
```

### Step 3: Add Deployment to Staging

Extend the workflow to include deployment:

```yaml
  deploy-staging:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v4

    - name: Configure kubectl
      uses: azure/k8s-set-context@v3
      with:
        method: kubeconfig
        kubeconfig: ${{ secrets.KUBE_CONFIG }}

    - name: Deploy to staging
      run: |
        kubectl apply -f k8s/staging/
        kubectl rollout status deployment/trixtech-backend
```

### Step 4: Test the Pipeline

1. Make a small change to your code
2. Commit and push to the main branch
3. Check the "Actions" tab to see the pipeline running
4. Verify deployment to staging environment

## Monitoring Quick Setup

### Step 1: Deploy Prometheus and Grafana

```bash
# Add Helm repositories
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/prometheus \
  --namespace monitoring \
  --create-namespace \
  --set server.persistentVolume.enabled=false

# Install Grafana
helm install grafana grafana/grafana \
  --namespace monitoring \
  --set adminPassword='admin' \
  --set service.type=ClusterIP
```

### Step 2: Access Monitoring Interfaces

```bash
# Get Grafana admin password
kubectl get secret --namespace monitoring grafana -o jsonpath="{.data.admin-password}" | base64 --decode

# Port forward services for local access
kubectl port-forward -n monitoring svc/prometheus-server 9090:80
kubectl port-forward -n monitoring svc/grafana 3000:80
```

### Step 3: Add Basic Dashboards

1. Access Grafana at http://localhost:3000
2. Login with admin/admin
3. Add Prometheus as data source (URL: http://prometheus-server.monitoring.svc.cluster.local)
4. Import basic dashboards or create simple ones

### Step 4: Set Up Basic Alerts

Create `alert_rules.yml`:

```yaml
groups:
- name: basic_alerts
  rules:
  - alert: ServiceDown
    expr: up == 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Service is down"
      description: "Service {{ $labels.job }} is down"
```

## Backup Automation Basics

### Step 1: Set Up Database Backup

Create a simple backup script:

```bash
#!/bin/bash
# Basic database backup script

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_HOST="postgres"
DB_USER="backup"
DB_NAME="trixtech"

mkdir -p $BACKUP_DIR

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql

# Clean old backups (keep last 7)
ls -t $BACKUP_DIR/*.sql.gz | tail -n +8 | xargs rm -f

echo "Backup completed: $BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
```

### Step 2: Schedule Automated Backups

```bash
# Add to crontab for daily backups at 2 AM
echo "0 2 * * * /opt/backup-scripts/db_backup.sh" | crontab -

# Test the backup
/opt/backup-scripts/db_backup.sh
```

### Step 3: Set Up Cloud Storage (Optional)

```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Upload backup to S3
aws s3 cp /opt/backups/ s3://trixtech-backups/database/ --recursive
```

## Security Automation Start

### Step 1: Enable Basic Security Scanning

Add security scanning to CI pipeline:

```yaml
# Add to .github/workflows/ci.yml
- name: Security scan
  uses: aquasecurity/trivy-action@master
  with:
    scan-type: 'fs'
    scan-ref: '.'
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload security results
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### Step 2: Set Up Basic Access Controls

```yaml
# Create basic RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: basic-user
  namespace: default
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: basic-user-binding
  namespace: default
roleRef:
  apiVersion: rbac.authorization.k8s.io/v1
  kind: Role
  name: basic-user
subjects:
- kind: User
  name: developer@example.com
```

### Step 3: Configure Basic Security Monitoring

```yaml
# Basic security alerts
groups:
- name: security_alerts
  rules:
  - alert: HighFailedLogins
    expr: rate(failed_login_total[5m]) > 5
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High rate of failed logins"
      description: "Failed login rate is {{ $value }} per minute"
```

## Common First Steps

### 1. Set Up Development Environment

```bash
# Clone repository
git clone https://github.com/trixtech/booking-system.git
cd booking-system

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Start development servers
npm run dev
```

### 2. Deploy to Staging

```bash
# Build and tag image
docker build -t trixtech/app:staging .

# Push to registry
docker push trixtech/app:staging

# Deploy to staging
kubectl apply -f k8s/staging/
kubectl rollout status deployment/trixtech-backend
```

### 3. Verify Basic Functionality

```bash
# Check pod status
kubectl get pods -l app=trixtech-backend

# Check service endpoints
kubectl get services

# Test application health
curl http://trixtech-staging.com/health

# Check logs
kubectl logs deployment/trixtech-backend --tail=50
```

### 4. Set Up Basic Monitoring

```bash
# Check application metrics
curl http://trixtech-backend:3000/metrics

# Verify monitoring collection
kubectl get pods -n monitoring

# Access Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
```

### 5. Configure Basic Alerts

```bash
# Test alert generation
curl -X POST http://prometheus-pushgateway:9091/metrics/job/test \
  -d 'test_metric 1'

# Check alert status
curl -s http://alertmanager:9093/api/v2/alerts | jq '.[] | select(.labels.alertname == "test")'
```

### 6. Set Up Automated Testing

```bash
# Run basic tests
npm test

# Run integration tests
npm run test:integration

# Set up test automation
# (Configure CI pipeline to run tests automatically)
```

### 7. Configure Basic Backup

```bash
# Test database connection
psql -h postgres -U postgres -d trixtech -c "SELECT 1;"

# Run manual backup
/opt/backup-scripts/db_backup.sh

# Verify backup integrity
ls -la /opt/backups/
```

### 8. Set Up Log Aggregation

```bash
# Check current logging
kubectl logs deployment/trixtech-backend --tail=20

# Configure basic log aggregation
# (Set up Fluentd or similar log collector)

# Verify log collection
kubectl get pods -l app=log-collector
```

## Troubleshooting Common Issues

### Pipeline Not Running

**Symptoms:** GitHub Actions not triggering

**Quick Fixes:**
```bash
# Check workflow syntax
gh workflow run --list

# Validate workflow file
yamllint .github/workflows/ci.yml

# Check repository settings
gh api repos/{owner}/{repo}/actions/permissions
```

### Deployment Failures

**Symptoms:** Application not deploying correctly

**Quick Fixes:**
```bash
# Check pod status
kubectl get pods
kubectl describe pod <failed-pod>

# Check deployment events
kubectl get events --sort-by=.metadata.creationTimestamp

# Verify image availability
docker pull trixtech/app:latest

# Check resource constraints
kubectl describe nodes
```

### Monitoring Not Working

**Symptoms:** Metrics not appearing in dashboards

**Quick Fixes:**
```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-server 9090:80
# Visit http://localhost:9090/targets

# Verify metrics endpoint
curl http://trixtech-backend:3000/metrics

# Check Grafana data source
kubectl port-forward -n monitoring svc/grafana 3000:80
# Visit http://localhost:3000 and check data sources
```

### Database Connection Issues

**Symptoms:** Application cannot connect to database

**Quick Fixes:**
```bash
# Test database connectivity
kubectl run test-db --image=postgres --rm -it -- psql -h postgres -U postgres -d trixtech

# Check database service
kubectl get svc postgres

# Verify database credentials
kubectl get secret db-secret -o yaml
```

### Security Scan Failures

**Symptoms:** Security scans failing or not running

**Quick Fixes:**
```bash
# Check Trivy installation
trivy --version

# Test scan manually
trivy image nginx:latest

# Check scan permissions
ls -la /usr/local/bin/trivy
```

## Next Steps

### Immediate Priorities (Week 1-2)
- [ ] Complete basic CI/CD pipeline
- [ ] Set up staging environment
- [ ] Implement basic monitoring
- [ ] Configure automated backups
- [ ] Set up security scanning

### Short-term Goals (Month 1)
- [ ] Implement production deployment
- [ ] Set up comprehensive monitoring
- [ ] Configure advanced security automation
- [ ] Implement disaster recovery procedures
- [ ] Set up performance monitoring

### Medium-term Goals (Months 2-3)
- [ ] Implement auto-scaling
- [ ] Set up advanced alerting
- [ ] Configure self-healing mechanisms
- [ ] Implement comprehensive testing automation
- [ ] Set up advanced backup strategies

### Resources for Further Learning
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Setup Guides](../setup/)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)
- [Troubleshooting Guides](../troubleshooting/)
- [Maintenance Procedures](../maintenance/)

---

**Getting Help:** If you encounter issues not covered in this guide, check the detailed documentation or contact the DevOps team. Remember to document any issues and solutions you discover for future reference.