# 🚀 TRIXTECH Deployment Guide - Hostinger KVM1

## 📋 Overview
This guide provides optimized deployment instructions for the TRIXTECH booking system on Hostinger KVM1 VPS (1 vCPU, 4GB RAM, 50GB NVMe storage).

## ✅ Prerequisites

### 🖥️ Hostinger KVM1 Plan Requirements
- **Plan**: KVM1 (₱279/mo)
- **CPU**: 1 vCPU core
- **RAM**: 4GB
- **Storage**: 50GB NVMe SSD
- **Bandwidth**: 4TB
- **OS**: Ubuntu 20.04+ (recommended)

### 📋 Required Accounts & Services
- [ ] Hostinger KVM1 VPS account
- [ ] Domain name (pointed to VPS IP)
- [ ] MongoDB Atlas account (free tier)
- [ ] Gmail account (for SMTP)
- [ ] SSH access to VPS

## 🚀 Quick Deployment

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
sudo ufw allow 443
sudo ufw --force enable

# Reboot to apply Docker group changes
sudo reboot
```

### Step 2: Deploy TRIXTECH
```bash
# Clone repository
git clone https://github.com/your-username/trixtech-booking-system.git
cd trixtech-booking-system

# Run deployment script
chmod +x deploy-kvm1.sh
./deploy-kvm1.sh
```

### Step 3: Configure Environment Variables

**Backend Configuration (`backend/.env`):**
```bash
# Database (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trixtech_prod

# Security
JWT_SECRET=your-32-character-super-secret-key-here

# Email
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourdomain.com

# URLs
FRONTEND_URL=https://yourdomain.com
```

**Frontend Configuration (`frontend/.env.local`):**
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 4: Setup Domain & SSL

**Point Domain to VPS:**
1. Login to your domain registrar
2. Add A record: `@` → `your-vps-ip`
3. Add A record: `api` → `your-vps-ip`

**Install SSL Certificate:**
```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Step 5: Database Setup

**MongoDB Atlas (Free Tier):**
1. Create account at [mongodb.com](https://mongodb.com)
2. Create free cluster
3. Create database user
4. Whitelist your VPS IP: `0.0.0.0/0`
5. Get connection string and update `MONGODB_URI`

### Step 6: Email Configuration

**Gmail SMTP Setup:**
1. Enable 2-factor authentication
2. Generate App Password
3. Use App Password in `EMAIL_PASSWORD`

## 🔧 Resource Optimization for KVM1

### Memory Management
- **Backend**: Limited to 512MB RAM
- **Frontend**: Limited to 512MB RAM
- **Nginx**: Limited to 128MB RAM
- **Total**: ~1.2GB RAM usage (leaves ~2.8GB for system)

### CPU Management
- **Backend**: 0.5 CPU cores max
- **Frontend**: 0.5 CPU cores max
- **Nginx**: 0.2 CPU cores max

### Database Optimization
- Connection pool: 20 max (reduced from 100)
- Heartbeat frequency: 10s (reduced from 5s)
- Uses MongoDB Atlas (no local DB overhead)

## 📊 Monitoring & Maintenance

### View Logs
```bash
# All services
docker-compose -f docker-compose.kvm1.yml logs -f

# Specific service
docker-compose -f docker-compose.kvm1.yml logs -f backend
```

### Check Resource Usage
```bash
# Docker stats
docker stats

# System resources
htop
free -h
df -h
```

### Update Deployment
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.kvm1.yml build --no-cache
docker-compose -f docker-compose.kvm1.yml up -d
```

## 🚨 Troubleshooting

### Common Issues

**High Memory Usage:**
```bash
# Check memory usage
docker stats

# Restart services
docker-compose -f docker-compose.kvm1.yml restart
```

**Database Connection Issues:**
```bash
# Test connection
docker exec trixtech-backend-kvm1 mongo mongodb://mongodb:27017/trixtech_prod

# Check MongoDB Atlas status
# Ensure IP whitelist includes your VPS IP
```

**SSL Certificate Issues:**
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew
```

**Port Conflicts:**
```bash
# Check port usage
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

## 🔒 Security Checklist

- [ ] SSH key authentication enabled
- [ ] Root login disabled
- [ ] Firewall configured (UFW)
- [ ] SSL certificates installed
- [ ] Environment variables secured
- [ ] Database credentials protected
- [ ] Regular system updates scheduled

## 📈 Performance Optimization

### For KVM1 Limits:
- **Concurrent Users**: 50-100 (estimated)
- **Database Queries**: Optimized pooling
- **Static Assets**: CDN recommended for high traffic
- **Caching**: Redis optional (adds ~200MB RAM)

### Scaling Considerations:
- Monitor resource usage regularly
- Consider upgrading to KVM2 for higher traffic
- Implement CDN for static assets
- Use database read replicas if needed

## 🎯 Success Checklist

- [ ] Application accessible at `https://yourdomain.com`
- [ ] Admin panel works at `https://yourdomain.com/admin`
- [ ] User registration and login functional
- [ ] Email notifications working
- [ ] SSL certificate valid
- [ ] Database connections stable
- [ ] Resource usage within KVM1 limits

## 📞 Support

**Hostinger KVM1 Resources:**
- CPU: 1 vCPU
- RAM: 4GB
- Storage: 50GB NVMe
- Bandwidth: 4TB

**Recommended Monitoring:**
- Uptime: 99.9% SLA
- Support: 24/7 via ticket system
- Backups: Manual snapshots available

---

**🎉 Your TRIXTECH system is now deployed on Hostinger KVM1!**

For additional features or customizations, refer to the main documentation.