# 🚀 TRIXTECH Hostinger Deployment Checklist

## 📋 Pre-Deployment Preparation (Local)

### ✅ Completed by Setup Script
- [x] Environment files configured with placeholders
- [x] Docker production configurations ready
- [x] Nginx reverse proxy configured
- [x] SSL certificate directory structure created
- [x] Monitoring stack (Prometheus/Grafana) configured
- [x] Automated deployment scripts created
- [x] All documentation prepared

### 📁 Files Ready for Upload
- [ ] `docker-compose.prod.yml` - Production Docker setup
- [ ] `backend/.env.production` - Backend configuration template
- [ ] `frontend/.env.production` - Frontend configuration template
- [ ] `nginx/nginx.conf` - Reverse proxy configuration
- [ ] `scripts/deploy-to-hostinger.sh` - Automated deployment script
- [ ] `scripts/configure-deployment.sh` - Configuration helper script
- [ ] All project source code and dependencies

## 🏠 Hostinger Account Setup

### Account & Hosting
- [ ] Create Hostinger account at [hostinger.com](https://www.hostinger.com)
- [ ] Choose VPS or Cloud hosting plan (minimum 2GB RAM)
- [ ] Select Ubuntu 22.04 LTS operating system
- [ ] Complete payment and account verification
- [ ] Receive VPS access credentials via email

### Domain Purchase & Setup
- [ ] Purchase domain through Hostinger (recommended) OR external registrar
- [ ] If external: Update nameservers to Hostinger's:
  - `ns1.hostinger.com`
  - `ns2.hostinger.com`
  - `ns3.hostinger.com`
  - `ns4.hostinger.com`
- [ ] Wait for DNS propagation (24-48 hours)
- [ ] Verify domain resolves to VPS IP using [dnschecker.org](https://dnschecker.org)

## 🖥️ VPS Initial Setup

### Server Access
- [ ] Connect to VPS via SSH: `ssh root@YOUR_VPS_IP`
- [ ] Update system: `apt update && apt upgrade -y`

### Upload Project Files
Choose one method:
- [ ] **SCP/SFTP**: `scp -r /local/path root@VPS_IP:/opt/trixtech`
- [ ] **Git**: `git clone YOUR_REPO_URL` on VPS
- [ ] **File Manager**: Use Hostinger's file manager

## 🔧 Automated Deployment

### Run Deployment Script
- [ ] Navigate to project: `cd /opt/trixtech`
- [ ] Make script executable: `chmod +x scripts/deploy-to-hostinger.sh`
- [ ] Run deployment: `sudo bash scripts/deploy-to-hostinger.sh`
- [ ] Save generated credentials (Grafana password, MongoDB password, JWT secret)

### Verify Initial Deployment
- [ ] Check services: `docker-compose -f docker-compose.prod.yml ps`
- [ ] Test backend: `curl http://localhost:5000/api/health`
- [ ] Test frontend: `curl http://localhost:3000`
- [ ] Access Grafana: `http://YOUR_VPS_IP:3001` (use generated password)

## 🌐 Domain & SSL Configuration

### DNS Records Setup (Hostinger hPanel)
- [ ] Login to Hostinger hPanel
- [ ] Go to Domains → DNS Zone
- [ ] Add A records:
  - `@` → `YOUR_VPS_IP`
  - `api` → `YOUR_VPS_IP`
  - `monitor` → `YOUR_VPS_IP` (optional)

### SSL Certificate Setup
- [ ] In hPanel: SSL → Free SSL
- [ ] Issue SSL for main domain and subdomains
- [ ] Wait for certificate activation (5-10 minutes)

## ⚙️ Application Configuration

### Run Configuration Script
- [ ] Run: `bash scripts/configure-deployment.sh`
- [ ] Enter your domain name when prompted
- [ ] Configure optional services (Analytics, Sentry, etc.)

### Required Service Setup
- [ ] **MongoDB Atlas**:
  - Create account at [mongodb.com/atlas](https://cloud.mongodb.com)
  - Create free M0 cluster
  - Create database user
  - Whitelist VPS IP address
  - Get connection string
  - Update `backend/.env` with connection details

- [ ] **Email Service (Gmail)**:
  - Enable 2-factor authentication
  - Generate App Password: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
  - Update `backend/.env` with Gmail credentials

- [ ] **JWT Secret**:
  - Generate secure 32+ character secret
  - Update `backend/.env` JWT_SECRET

### Optional Services
- [ ] Google Analytics tracking ID
- [ ] Sentry error tracking DSN
- [ ] Social login (Facebook/Google)
- [ ] reCAPTCHA site key

## 🧪 Testing & Verification

### Application Testing
- [ ] Test main site: `https://YOUR_DOMAIN.com`
- [ ] Test admin panel: `https://YOUR_DOMAIN.com/admin`
- [ ] Test API: `https://api.YOUR_DOMAIN.com/api/health`
- [ ] Test user registration and login
- [ ] Test booking functionality
- [ ] Test payment processing

### Monitoring Setup
- [ ] Access Grafana: `https://YOUR_DOMAIN.com:3001`
- [ ] Login with generated admin credentials
- [ ] Verify dashboards are working
- [ ] Check Prometheus metrics: `https://YOUR_DOMAIN.com:9090`

### SSL Verification
- [ ] Check SSL certificate: [sslshopper.com/ssl-checker](https://www.sslshopper.com/ssl-checker)
- [ ] Verify HTTPS redirect works
- [ ] Test all subdomains have valid SSL

## 🔧 Post-Deployment Tasks

### Security Hardening
- [ ] Change default Grafana admin password
- [ ] Review firewall rules (should be auto-configured)
- [ ] Enable automatic security updates
- [ ] Set up monitoring alerts

### Backup Setup
- [ ] Configure automated daily backups
- [ ] Test backup restoration process
- [ ] Set up off-site backup storage

### Performance Optimization
- [ ] Monitor resource usage
- [ ] Configure log rotation
- [ ] Set up automated service restarts
- [ ] Enable gzip compression (configured in nginx)

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Monitor application logs: `docker-compose logs -f`
- [ ] Check service health
- [ ] Verify SSL certificate validity
- [ ] Monitor disk space usage

### Weekly Tasks
- [ ] Review error logs
- [ ] Check backup integrity
- [ ] Update Docker images: `docker-compose pull`
- [ ] Security updates: `apt update && apt upgrade`

### Monthly Tasks
- [ ] Performance review
- [ ] Log analysis
- [ ] User feedback review
- [ ] Feature updates based on analytics

## 🚨 Emergency Procedures

### Service Issues
- [ ] Check service status: `docker-compose ps`
- [ ] View logs: `docker-compose logs SERVICE_NAME`
- [ ] Restart services: `docker-compose restart`
- [ ] Full restart: `docker-compose down && docker-compose up -d`

### Domain Issues
- [ ] Check DNS propagation: [dnschecker.org](https://dnschecker.org)
- [ ] Verify DNS records in hPanel
- [ ] Contact Hostinger support if needed

### SSL Issues
- [ ] Check certificate expiry
- [ ] Reissue SSL in hPanel
- [ ] Verify nginx configuration

## 📞 Support Resources

### Hostinger Support
- **24/7 Live Chat**: Available in hPanel
- **Knowledge Base**: [support.hostinger.com](https://support.hostinger.com)
- **Ticket System**: For complex issues

### TRIXTECH Resources
- **Deployment Guide**: `DEPLOYMENT_HOSTINGER.md`
- **Domain Setup**: `DOMAIN_SETUP_GUIDE.md`
- **Maintenance**: `MAINTENANCE_GUIDE.md`
- **Troubleshooting**: Check individual service logs

## ✅ Final Verification

- [ ] Application accessible at `https://YOUR_DOMAIN.com`
- [ ] Admin panel working
- [ ] User registration functional
- [ ] Email notifications working
- [ ] Payment processing operational
- [ ] SSL certificates valid
- [ ] Monitoring dashboards accessible
- [ ] Automated backups configured
- [ ] All security measures in place

---

## 🎉 Deployment Complete!

**Your TRIXTECH booking system is now live on Hostinger!**

**Access URLs:**
- 🌐 **Main Site**: `https://YOUR_DOMAIN.com`
- 🔧 **API**: `https://api.YOUR_DOMAIN.com`
- 📊 **Monitoring**: `https://YOUR_DOMAIN.com:3001`
- 📈 **Metrics**: `https://YOUR_DOMAIN.com:9090`

**Important Credentials Saved:**
- Grafana Admin Password: `____________`
- MongoDB Root Password: `____________`
- JWT Secret: `____________`

**Next Steps:**
1. Create your first admin user
2. Configure business settings
3. Set up payment methods
4. Start marketing your booking system!

---

*This checklist ensures a smooth, secure deployment of your TRIXTECH system on Hostinger.*