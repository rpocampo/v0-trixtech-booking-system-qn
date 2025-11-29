# CI/CD Setup Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [GitHub Repository Setup](#github-repository-setup)
4. [Workflow Configuration](#workflow-configuration)
5. [Environment Configuration](#environment-configuration)
6. [Testing and Validation](#testing-and-validation)
7. [Deployment Strategies](#deployment-strategies)
8. [Troubleshooting](#troubleshooting)
9. [Related Documentation](#related-documentation)

## Introduction

This guide provides step-by-step instructions for setting up Continuous Integration and Continuous Deployment (CI/CD) pipelines using GitHub Actions for the TRIXTECH Booking System. The CI/CD pipeline automates testing, building, and deployment processes across development, staging, and production environments.

## Prerequisites

- GitHub repository with admin access
- Docker Hub or similar container registry access
- Kubernetes cluster access (for deployment)
- Environment secrets configured in GitHub
- Node.js and npm installed locally for testing

### Required Secrets

Set the following secrets in your GitHub repository (Settings > Secrets and variables > Actions):

```
DOCKER_USERNAME: Your Docker Hub username
DOCKER_PASSWORD: Your Docker Hub password or access token
KUBE_CONFIG: Base64 encoded Kubernetes config
PROD_DATABASE_URL: Production database connection string
STAGING_DATABASE_URL: Staging database connection string
JWT_SECRET: JWT signing secret
```

## GitHub Repository Setup

### 1. Enable GitHub Actions

1. Navigate to your repository on GitHub
2. Go to Settings > Actions > General
3. Select "Allow all actions and reusable workflows"
4. Enable "Read and write permissions" for GITHUB_TOKEN

### 2. Create Branch Protection Rules

1. Go to Settings > Branches
2. Add rule for `main` branch:
   - Require pull request reviews
   - Require status checks to pass
   - Include administrators
   - Restrict pushes that create matching branches

### 3. Set Up Environments

1. Go to Settings > Environments
2. Create environments: `staging` and `production`
3. Configure environment secrets for each

## Workflow Configuration

### Main CI/CD Workflow

Create `.github/workflows/ci-cd.yml`:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

env:
  REGISTRY: docker.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'

    - name: Install backend dependencies
      run: |
        cd backend
        npm ci

    - name: Run backend tests
      run: |
        cd backend
        npm test

    - name: Install frontend dependencies
      run: |
        cd frontend
        npm ci

    - name: Run frontend tests
      run: |
        cd frontend
        npm run test

    - name: Build frontend
      run: |
        cd frontend
        npm run build

  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v4

    - name: Log in to Docker Hub
      uses: docker/login-action@v3
      with:
        username: ${{ secrets.DOCKER_USERNAME }}
        password: ${{ secrets.DOCKER_PASSWORD }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=sha

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  deploy-staging:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: staging
    if: github.ref == 'refs/heads/main'

    steps:
    - uses: actions/checkout@v4

    - name: Deploy to staging
      run: |
        echo "Deploying to staging environment"
        # Add your staging deployment commands here
        kubectl apply -f k8s/staging/ --kubeconfig <(echo $KUBE_CONFIG | base64 -d)

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
    - uses: actions/checkout@v4

    - name: Deploy to production
      run: |
        echo "Deploying to production environment"
        # Add your production deployment commands here
        kubectl apply -f k8s/production/ --kubeconfig <(echo $KUBE_CONFIG | base64 -d)
```

### Additional Workflows

#### Security Scan Workflow (`.github/workflows/security.yml`)

```yaml
name: Security Scan

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]
  schedule:
    - cron: '0 2 * * 1'  # Weekly on Monday

jobs:
  security-scan:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'fs'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'

    - name: Upload Trivy scan results
      uses: github/codeql-action/upload-sarif@v2
      if: always()
      with:
        sarif_file: 'trivy-results.sarif'
```

## Environment Configuration

### Staging Environment

Create `k8s/staging/deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-booking-staging
spec:
  replicas: 2
  selector:
    matchLabels:
      app: trixtech-booking
      environment: staging
  template:
    metadata:
      labels:
        app: trixtech-booking
        environment: staging
    spec:
      containers:
      - name: app
        image: your-registry/trixtech-booking:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "staging"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: staging-url
```

### Production Environment

Create `k8s/production/deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-booking-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trixtech-booking
      environment: production
  template:
    metadata:
      labels:
        app: trixtech-booking
        environment: production
    spec:
      containers:
      - name: app
        image: your-registry/trixtech-booking:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: prod-url
```

## Testing and Validation

### Local Testing

1. Run tests locally before pushing:
   ```bash
   # Backend tests
   cd backend
   npm test

   # Frontend tests
   cd frontend
   npm run test
   ```

2. Build Docker image locally:
   ```bash
   docker build -t trixtech-booking:test .
   ```

### Pipeline Testing

1. Create a feature branch
2. Make changes and commit
3. Push to trigger CI pipeline
4. Check GitHub Actions tab for results
5. Create pull request to merge to main

## Deployment Strategies

### Blue-Green Deployment

For zero-downtime deployments:

```yaml
# Blue deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trixtech-booking-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trixtech-booking
      color: blue
  template:
    metadata:
      labels:
        app: trixtech-booking
        color: blue
    spec:
      containers:
      - name: app
        image: your-registry/trixtech-booking:v2.0.0
```

### Canary Deployment

Gradual rollout:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: trixtech-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "20"
spec:
  rules:
  - host: booking.trixtech.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: trixtech-booking-canary
            port:
              number: 80
```

## Troubleshooting

### Common Issues

#### Pipeline Fails on Test Stage

**Symptoms:** Tests fail in CI but pass locally

**Solutions:**
1. Check Node.js version in workflow matches local version
2. Ensure all dependencies are in package-lock.json
3. Verify environment variables are set correctly
4. Check for race conditions in tests

#### Docker Build Fails

**Symptoms:** Build step fails with Docker errors

**Solutions:**
1. Verify Dockerfile syntax
2. Check build context path
3. Ensure all required files are included in .dockerignore
4. Validate base image availability

#### Deployment Fails

**Symptoms:** Kubernetes deployment fails

**Solutions:**
1. Check kubectl configuration
2. Verify cluster connectivity
3. Validate YAML syntax
4. Check resource quotas and limits

#### Permission Denied Errors

**Symptoms:** Actions fail with permission errors

**Solutions:**
1. Verify GITHUB_TOKEN permissions
2. Check repository settings for Actions
3. Ensure secrets are properly configured
4. Validate Docker registry credentials

### Debugging Steps

1. Check GitHub Actions logs for detailed error messages
2. Use `kubectl describe` to inspect failed pods
3. Review container logs with `kubectl logs`
4. Test locally with same environment variables
5. Use GitHub's workflow rerun feature for failed jobs

## Related Documentation

- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Deployment Procedures](../operations/DEPLOYMENT_PROCEDURES.md)
- [CI/CD Troubleshooting](../troubleshooting/CI_CD_TROUBLESHOOTING.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Update this guide when modifying CI/CD workflows or deployment strategies. Test all changes in a feature branch before merging to main.