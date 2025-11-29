# CI/CD Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2024-11-29  
**Authors:** TRIXTECH DevOps Team

## Table of Contents

1. [Introduction](#introduction)
2. [Pipeline Failure Diagnosis](#pipeline-failure-diagnosis)
3. [Common Pipeline Issues](#common-pipeline-issues)
4. [Build Failures](#build-failures)
5. [Test Failures](#test-failures)
6. [Deployment Failures](#deployment-failures)
7. [Rollback Procedures](#rollback-procedures)
8. [Debugging Techniques](#debugging-techniques)
9. [Prevention Strategies](#prevention-strategies)
10. [Related Documentation](#related-documentation)

## Introduction

This guide provides comprehensive troubleshooting procedures for CI/CD pipeline issues in the TRIXTECH Booking System. It covers diagnosis, resolution, and prevention of common pipeline failures, with step-by-step procedures for effective problem resolution.

## Pipeline Failure Diagnosis

### Initial Assessment

**When a pipeline fails:**

1. **Check Pipeline Status**
   ```bash
   # Check GitHub Actions status
   gh run list --limit 5

   # Get detailed run information
   gh run view <run-id> --log
   ```

2. **Identify Failure Point**
   ```bash
   # Check which job/step failed
   gh run view <run-id> --json jobs | jq '.jobs[] | select(.conclusion == "failure") | .name'

   # Review failure logs
   gh run view <run-id> --job <job-id> --log
   ```

3. **Gather Context**
   - What changed since last successful run?
   - Which branch/PR triggered the pipeline?
   - What environment variables were used?
   - Were there any infrastructure changes?

### Diagnostic Checklist

- [ ] Pipeline triggered correctly
- [ ] All required secrets available
- [ ] Repository permissions correct
- [ ] Branch protection rules not blocking
- [ ] Required runners available
- [ ] Network connectivity to external services
- [ ] Dependencies accessible

## Common Pipeline Issues

### Pipeline Not Triggering

**Symptoms:** Push/PR doesn't start pipeline

**Possible Causes:**
1. Incorrect workflow triggers
2. Branch not matching patterns
3. Repository settings issues
4. GitHub Actions disabled

**Solutions:**

1. **Check Workflow Triggers**
   ```yaml
   # Verify trigger configuration
   on:
     push:
       branches: [ main, develop ]
     pull_request:
       branches: [ main ]
   ```

2. **Verify Branch Patterns**
   ```bash
   # Check current branch
   git branch --show-current

   # Verify branch matches workflow patterns
   git log --oneline -5
   ```

3. **Check Repository Settings**
   - Go to Settings > Actions > General
   - Ensure "Allow all actions" is selected
   - Check "Read and write permissions" enabled

### Runner Issues

**Symptoms:** Jobs queued but not running

**Possible Causes:**
1. Runner capacity exceeded
2. Runner offline/unhealthy
3. Runner labels incorrect
4. Resource quotas reached

**Solutions:**

1. **Check Runner Status**
   ```bash
   # Check self-hosted runners
   gh api repos/{owner}/{repo}/actions/runners | jq '.runners[] | {name, status, busy}'

   # Check GitHub-hosted runner availability
   # Usually shown in Actions tab
   ```

2. **Scale Runner Capacity**
   ```bash
   # For self-hosted runners, add more instances
   # Update runner group configuration
   ```

3. **Check Runner Labels**
   ```yaml
   # Ensure job matches runner labels
   jobs:
     test:
       runs-on: [self-hosted, linux, x64]
   ```

## Build Failures

### Dependency Installation Issues

**Symptoms:** npm/yarn install fails

**Common Issues:**
1. Package not found
2. Version conflicts
3. Network timeouts
4. Cache corruption

**Solutions:**

1. **Check Package Availability**
   ```bash
   # Verify package exists
   npm view <package-name>

   # Check version availability
   npm view <package-name> versions --json
   ```

2. **Resolve Version Conflicts**
   ```bash
   # Check for conflicts
   npm ls --depth=0

   # Update package.json to resolve conflicts
   # Use npm audit fix for security issues
   npm audit fix
   ```

3. **Network Issues**
   ```bash
   # Use different registry
   npm config set registry https://registry.npmjs.org/

   # Clear npm cache
   npm cache clean --force

   # Retry with verbose logging
   npm install --verbose
   ```

4. **Cache Issues**
   ```yaml
   # Clear and rebuild cache
   - name: Clear npm cache
     run: npm cache clean --force

   - name: Install dependencies
     run: npm ci
   ```

### Build Tool Errors

**Symptoms:** Compilation/build fails

**Common Issues:**
1. Syntax errors
2. Missing imports
3. Type errors
4. Build tool configuration

**Solutions:**

1. **Check Code Syntax**
   ```bash
   # Run linter locally
   npm run lint

   # Check TypeScript compilation
   npx tsc --noEmit
   ```

2. **Verify Imports**
   ```bash
   # Check for missing dependencies
   grep "import.*from" src/**/*.ts | head -10

   # Verify file paths
   find src -name "*.ts" | head -10
   ```

3. **Build Configuration**
   ```bash
   # Check build configuration
   cat package.json | jq '.scripts.build'

   # Verify build tool versions
   npm list --depth=0
   ```

### Docker Build Failures

**Symptoms:** Docker build fails

**Common Issues:**
1. Base image issues
2. COPY/ADD failures
3. RUN command errors
4. Size limits exceeded

**Solutions:**

1. **Base Image Issues**
   ```bash
   # Check base image availability
   docker pull node:18-alpine

   # Verify image digest
   docker inspect node:18-alpine | jq '.[0].RepoDigests'
   ```

2. **Build Context Issues**
   ```bash
   # Check .dockerignore
   cat .dockerignore

   # Verify files are included
   docker build --no-cache -t test .

   # Use buildkit for better error messages
   DOCKER_BUILDKIT=1 docker build .
   ```

3. **Layer Caching Issues**
   ```dockerfile
   # Optimize Dockerfile for caching
   FROM node:18-alpine
   WORKDIR /app

   # Copy package files first
   COPY package*.json ./
   RUN npm ci --only=production

   # Copy source code
   COPY . .
   RUN npm run build
   ```

## Test Failures

### Unit Test Failures

**Symptoms:** Tests pass locally but fail in CI

**Common Issues:**
1. Environment differences
2. Race conditions
3. Missing test dependencies
4. Flaky tests

**Solutions:**

1. **Environment Differences**
   ```bash
   # Check Node.js version
   node --version

   # Check npm version
   npm --version

   # Verify environment variables
   env | grep -E "(NODE|NPM)"
   ```

2. **Race Conditions**
   ```javascript
   // Fix race conditions in tests
   describe('Database Tests', () => {
     beforeEach(async () => {
       await db.clear(); // Clear database before each test
     });

     it('should create booking', async () => {
       const booking = await createBooking(testData);
       expect(booking.id).toBeDefined();
     });
   });
   ```

3. **Flaky Test Detection**
   ```bash
   # Run tests multiple times to identify flakes
   for i in {1..5}; do
     npm test
     if [ $? -ne 0 ]; then
       echo "Test failed on run $i"
       exit 1
     fi
   done
   ```

### Integration Test Failures

**Symptoms:** Tests fail when interacting with external services

**Common Issues:**
1. Service unavailable
2. Network timeouts
3. Authentication issues
4. Data inconsistencies

**Solutions:**

1. **Service Dependencies**
   ```yaml
   # Ensure test services are running
   services:
     postgres:
       image: postgres:13
       env:
         POSTGRES_PASSWORD: test
       options: >-
         --health-cmd pg_isready
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
   ```

2. **Network Issues**
   ```bash
   # Test service connectivity
   curl -f http://localhost:5432

   # Check network configuration
   docker network ls
   ```

3. **Data Setup**
   ```javascript
   // Ensure test data is properly seeded
   beforeAll(async () => {
     await seedTestData();
   });

   afterAll(async () => {
     await cleanupTestData();
   });
   ```

### End-to-End Test Failures

**Symptoms:** E2E tests fail in headless mode

**Common Issues:**
1. Browser compatibility
2. Timing issues
3. Element not found
4. Network requests failing

**Solutions:**

1. **Browser Configuration**
   ```javascript
   // Configure Playwright for CI
   const config = {
     use: {
       headless: true,
       viewport: { width: 1280, height: 720 },
       ignoreHTTPSErrors: true,
       video: 'retain-on-failure',
       screenshot: 'only-on-failure',
     },
     expect: {
       timeout: 30000,
     },
   };
   ```

2. **Timing Issues**
   ```javascript
   // Wait for elements properly
   await page.waitForSelector('.booking-form', { timeout: 10000 });
   await page.fill('.customer-name', 'Test User');
   await page.click('.submit-button');

   // Wait for navigation or API call
   await page.waitForResponse(response => response.url().includes('/api/bookings'));
   ```

## Deployment Failures

### Kubernetes Deployment Issues

**Symptoms:** kubectl apply fails or pods don't start

**Common Issues:**
1. Image pull errors
2. Resource constraints
3. Configuration errors
4. Network policies

**Solutions:**

1. **Image Issues**
   ```bash
   # Check image exists
   docker pull trixtech/backend:latest

   # Verify image digest
   kubectl describe pod <pod-name> | grep "Image ID"
   ```

2. **Resource Issues**
   ```bash
   # Check resource availability
   kubectl describe nodes | grep -A 5 "Allocated resources"

   # Check pod resource requests
   kubectl describe pod <pod-name> | grep -A 5 "Requests:"
   ```

3. **Configuration Validation**
   ```bash
   # Validate YAML syntax
   kubectl apply --dry-run=client -f deployment.yaml

   # Check for validation errors
   kubectl apply -f deployment.yaml --validate
   ```

### Helm Deployment Failures

**Symptoms:** helm upgrade/install fails

**Common Issues:**
1. Chart syntax errors
2. Value overrides incorrect
3. Dependency issues
4. Namespace permissions

**Solutions:**

1. **Chart Validation**
   ```bash
   # Lint chart
   helm lint ./charts/trixtech

   # Template chart
   helm template trixtech ./charts/trixtech

   # Dry run installation
   helm install --dry-run trixtech ./charts/trixtech
   ```

2. **Value Overrides**
   ```bash
   # Check values file
   helm template trixtech ./charts/trixtech --values values.yaml

   # Debug value rendering
   helm get values trixtech
   ```

### Rollback Procedures

#### Automatic Rollback

```yaml
# Add rollback step to workflow
- name: Rollback on failure
  if: failure()
  run: |
    # Rollback deployment
    kubectl rollout undo deployment/trixtech-backend

    # Wait for rollback to complete
    kubectl rollout status deployment/trixtech-backend

    # Verify rollback success
    kubectl get pods -l app=trixtech-backend
```

#### Manual Rollback

**Immediate Rollback Steps:**

1. **Stop Failed Deployment**
   ```bash
   # Scale down failing deployment
   kubectl scale deployment trixtech-backend --replicas=0
   ```

2. **Restore Previous Version**
   ```bash
   # Rollback to previous revision
   kubectl rollout undo deployment/trixtech-backend --to-revision=1

   # Wait for rollback
   kubectl rollout status deployment/trixtech-backend
   ```

3. **Verify Rollback**
   ```bash
   # Check pod status
   kubectl get pods -l app=trixtech-backend

   # Verify application health
   curl -f https://api.trixtech.com/health
   ```

4. **Clean Up**
   ```bash
   # Remove failed resources
   kubectl delete deployment trixtech-backend-failed

   # Clean up dangling images
   docker system prune -f
   ```

#### Rollback Validation

**Post-Rollback Checks:**
- [ ] Application accessible
- [ ] Core functionality working
- [ ] Database connections stable
- [ ] Monitoring alerts cleared
- [ ] User impact assessed

## Debugging Techniques

### Local Pipeline Testing

1. **Test Workflow Locally**
   ```bash
   # Use act for local GitHub Actions testing
   act -j test --container-architecture linux/amd64

   # Test specific workflow
   act -j build --container-architecture linux/amd64
   ```

2. **Debug Build Issues**
   ```bash
   # Run build locally
   npm run build

   # Test in same container as CI
   docker run --rm -v $(pwd):/app node:18 npm run build
   ```

### Log Analysis

1. **Pipeline Logs**
   ```bash
   # Get detailed logs
   gh run view <run-id> --log > pipeline.log

   # Search for specific errors
   grep -i "error\|fail\|exception" pipeline.log
   ```

2. **Application Logs**
   ```bash
   # Check application logs during deployment
   kubectl logs -l app=trixtech-backend --since=1h

   # Follow logs in real-time
   kubectl logs -f deployment/trixtech-backend
   ```

### Network Debugging

1. **Connectivity Tests**
   ```bash
   # Test external service connectivity
   curl -v https://registry.npmjs.org/

   # Test Docker registry
   docker login docker.io

   # Test Kubernetes API
   kubectl cluster-info
   ```

2. **DNS Resolution**
   ```bash
   # Check DNS resolution
   nslookup registry.npmjs.org

   # Test from container
   docker run --rm busybox nslookup registry.npmjs.org
   ```

### Performance Debugging

1. **Build Performance**
   ```bash
   # Time individual steps
   time npm install
   time npm run build
   time npm test
   ```

2. **Resource Usage**
   ```bash
   # Monitor resource usage during build
   top -b -d 1 | head -20

   # Check disk space
   df -h
   ```

## Prevention Strategies

### Pipeline Reliability

1. **Idempotent Operations**
   ```yaml
   # Make jobs idempotent
   - name: Deploy
     run: |
       kubectl apply -f k8s/ --prune
       kubectl wait --for=condition=available --timeout=300s deployment/trixtech-backend
   ```

2. **Graceful Failure Handling**
   ```yaml
   # Handle failures gracefully
   - name: Cleanup on failure
     if: failure()
     run: |
       echo "Pipeline failed, cleaning up..."
       kubectl delete -f k8s/ --ignore-not-found=true
   ```

3. **Retry Mechanisms**
   ```yaml
   # Add retry logic
   - name: Flaky test
     uses: nick-invision/retry@v2
     with:
       timeout_minutes: 10
       max_attempts: 3
       command: npm test
   ```

### Quality Gates

1. **Pre-commit Hooks**
   ```bash
   # Install husky for pre-commit hooks
   npm install husky --save-dev
   npx husky install

   # Add pre-commit hook
   echo 'npm run lint && npm run test:unit' > .husky/pre-commit
   ```

2. **Branch Protection**
   ```json
   // GitHub branch protection rules
   {
     "required_status_checks": {
       "strict": true,
       "contexts": ["test", "lint", "security-scan"]
     },
     "enforce_admins": true,
     "required_pull_request_reviews": {
       "required_approving_review_count": 2
     },
     "restrictions": null
   }
   ```

### Monitoring and Alerting

1. **Pipeline Monitoring**
   ```yaml
   # Monitor pipeline health
   - name: Report pipeline status
     if: always()
     run: |
       # Send metrics to monitoring system
       curl -X POST https://monitoring.trixtech.com/api/pipeline-status \
         -d "{\"status\": \"${{ job.status }}\", \"duration\": \"${{ github.event.head_commit.timestamp }}\"}"
   ```

2. **Failure Pattern Analysis**
   ```bash
   # Analyze failure patterns
   gh run list --limit 100 --json conclusion,createdAt | \
     jq 'group_by(.conclusion) | map({conclusion: .[0].conclusion, count: length})'
   ```

## Related Documentation

- [CI/CD Setup](../setup/CI_CD_SETUP.md)
- [Automation Overview](../AUTOMATION_OVERVIEW.md)
- [Deployment Procedures](../operations/DEPLOYMENT_PROCEDURES.md)
- [Configuration Reference](../CONFIGURATION_REFERENCE.md)

---

**Update Procedures:** Review pipeline failures monthly. Update troubleshooting procedures based on new failure patterns. Maintain comprehensive pipeline documentation.