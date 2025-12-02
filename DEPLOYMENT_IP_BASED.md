# 🚀 TRIXTECH IP-Based Deployment Guide
## Deploy Before Purchasing Domain

This guide provides instructions for deploying TRIXTECH on Hostinger KVM1 **before purchasing a domain**. The system will run on your server's IP address and can be accessed via `http://YOUR_SERVER_IP`.

## ✅ Prerequisites

### 🖥️ Hostinger KVM1 Plan Requirements
- **Plan**: KVM1 (₱279/mo)
- **CPU**: 1 vCPU core
- **RAM**: 4GB
- **Storage**: 50GB NVMe SSD
- **Bandwidth**: 4TB
- **OS**: Ubuntu 20.04+

### 📋 Required Accounts & Services
- [ ] Hostinger KVM1 VPS account
- [ ] Gmail account (for SMTP - already configured)
- [ ] SSH access to VPS
- [ ] **MongoDB will run locally on KVM1 (no external account needed)**

## ⚡ One-Command Automated Deployment

**The easiest way to deploy TRIXTECH - just one command!**

```bash
# On a fresh KVM1 VPS (run as root or with sudo)
wget -O deploy.sh https://raw.githubusercontent.com/your-username/trixtech-booking-system/main/deploy-full-auto.sh && chmod +x deploy.sh && ./deploy.sh
```

### What happens automatically:
- ✅ **Server Setup**: Installs Docker, Docker Compose, configures firewall
- ✅ **Application Deployment**: Clones repo, configures environment, deploys services
- ✅ **Database Setup**: Initializes MongoDB with collections and indexes
- ✅ **Health Checks**: Verifies all services are running properly
- ✅ **Monitoring**: Sets up automated backups and log rotation
- ✅ **Access Info**: Provides URLs and credentials

### Time: 10-15 minutes
### Result: Fully functional booking system accessible via IP address

---

## 🚀 Manual IP-Based Deployment

### Step 1: Initial Server Setup
```bash
# Connect to your VPS via SSH
ssh root@your-vps-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl wget git htop ufw

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Configure firewall
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw --force enable

# Reboot to apply Docker group changes
sudo reboot
```

### Step 2: Deploy TRIXTECH (IP-Based)
```bash
# Connect again after reboot
ssh root@your-vps-ip

# Clone repository
git clone https://github.com/your-username/trixtech-booking-system.git
cd trixtech-booking-system

# Make deployment script executable
chmod +x deploy-ip.sh

# Run IP-based deployment
./deploy-ip.sh
```

### Step 3: Configure Environment Variables

**Backend Configuration (`backend/.env`):**
```bash
# Database (Local MongoDB on KVM1)
MONGODB_URI=mongodb://trixtech_user:trixtech2024!@mongodb:27017/trixtech_prod?authSource=trixtech_prod

# Security
JWT_SECRET=your-32-character-super-secret-key-here-change-in-production

# Frontend URL (use your server IP)
FRONTEND_URL=http://YOUR_SERVER_IP

# Email (already configured)
EMAIL_USER=trixtech011@gmail.com
EMAIL_PASSWORD=your-app-password
```

**MongoDB Local Setup:**
- **Database**: `trixtech_prod`
- **Username**: `trixtech_user`
- **Password**: `trixtech2024!`
- **Port**: `27017`
- **Auto-initialized** with collections and indexes on first startup

**Frontend Configuration (`frontend/.env.local`):**
```bash
# Use your server IP
NEXT_PUBLIC_API_URL=http://YOUR_SERVER_IP
NEXT_PUBLIC_SOCKET_URL=http://YOUR_SERVER_IP
NEXT_PUBLIC_APP_URL=http://YOUR_SERVER_IP
```

### Step 4: Access Your Application
After deployment, your application will be available at:
- **Frontend**: `http://YOUR_SERVER_IP`
- **Admin Panel**: `http://YOUR_SERVER_IP/admin`
- **API**: `http://YOUR_SERVER_IP/api`

## 🔧 Configuration Details

### IP-Based Nginx Configuration
The IP-based deployment uses `nginx/nginx-ip.conf` which:
- Listens on port 80 for all incoming requests
- No domain restrictions (works with any IP)
- Proxies requests to frontend (port 3000) and backend (port 5000)

### Docker Compose Configuration
The `docker-compose-ip.yml` file:
- Uses IP-based environment variables
- Optimized for KVM1 resources
- Includes health checks and proper resource limits

## 📊 Testing Your IP-Based Deployment

### Health Checks
```bash
# Test backend health
curl http://YOUR_SERVER_IP/api/health

# Test frontend
curl http://YOUR_SERVER_IP
```

### Access URLs
- **Customer Portal**: `http://YOUR_SERVER_IP`
- **Admin Dashboard**: `http://YOUR_SERVER_IP/admin`
- **API Documentation**: `http://YOUR_SERVER_IP/api`

## 🔄 Switching to Domain-Based Deployment

When you're ready to purchase a domain:

1. **Purchase Domain**: Buy your domain from any registrar
2. **Update DNS**: Point A records to your server IP
3. **Run Domain Deployment**:
   ```bash
   # Stop IP-based deployment
   docker-compose -f docker-compose-ip.yml down

   # Update environment files with domain
   # Edit frontend/.env.local and backend/.env with domain URLs

   # Run domain-based deployment
   ./deploy-kvm1.sh
   ```

4. **Setup SSL**: Follow the SSL setup instructions in `DEPLOYMENT_HOSTINGER_KVM1.md`

## 🚨 Important Notes

### IP-Based Limitations
- **No SSL**: HTTPS not available (requires domain for Let's Encrypt)
- **IP Changes**: If Hostinger changes your IP, you'll need to update configurations
- **SEO**: Search engines prefer domains over IP addresses
- **User Trust**: IP addresses look less professional than domains

### Security Considerations
- Consider IP whitelisting in MongoDB Atlas
- Regular security updates recommended
- Monitor access logs for suspicious activity

## 📞 Support

**IP-Based Deployment Issues:**
- Check server firewall settings
- Verify Docker containers are running: `docker ps`
- Check logs: `docker-compose -f docker-compose-ip.yml logs`

**Domain Migration:**
- DNS propagation can take 24-48 hours
- Keep IP-based deployment running during transition
- Test thoroughly before switching permanently

## 🛠️ Management & Monitoring Scripts

### Check Deployment Status
```bash
# Check health of all services
./check-deployment-status.sh
```

### Backup Database
```bash
# Create manual backup
./mongodb/backup-mongo.sh
```

### Rollback Deployment
```bash
# Emergency rollback (preserves data)
./rollback-deployment.sh
```

### View Logs
```bash
# All services
docker-compose -f docker-compose-ip.yml logs -f

# Specific service
docker-compose -f docker-compose-ip.yml logs -f backend
```

### Restart Services
```bash
# Restart all services
docker-compose -f docker-compose-ip.yml restart

# Restart specific service
docker-compose -f docker-compose-ip.yml restart frontend
```

---

**🎯 Complete automated deployment system ready! Your booking system will be live in minutes with full monitoring and management capabilities.**