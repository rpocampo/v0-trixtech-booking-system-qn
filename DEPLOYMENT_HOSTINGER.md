# 🚀 TRIXTECH Deployment Guide for Hostinger

## 📋 Overview
This guide provides step-by-step instructions for deploying the TRIXTECH Web-Based Booking and Reservation System to Hostinger's VPS or Cloud hosting platforms. The deployment uses Docker containers for easy management and scalability.

## ✅ Prerequisites

### 🛠️ System Requirements
- [ ] Hostinger VPS or Cloud hosting plan (minimum 2GB RAM, 1 CPU core)
- [ ] Domain name registered and pointed to Hostinger
- [ ] SSH access to your Hostinger server
- [ ] MongoDB Atlas account (cloud database) or local MongoDB
- [ ] Email service configured (Gmail, SendGrid, etc.)

### 🔐 Required Environment Variables
Create production environment files before deployment:

**Backend (.env.production):**
```env
# Environment
NODE_ENV=production
PORT=5000

# Database (MongoDB Atlas recommended)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trixtech_prod

# Security
JWT_SECRET=your-32-character-super-secret-key-here
BCRYPT_ROUNDS=12

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
ADMIN_EMAIL=admin@yourdomain.com
SENDER_EMAIL=noreply@yourdomain.com

# Server
FRONTEND_URL=https://yourdomain.com

# GCash Payment
GCASH_QR_CODE=your-gcash-qr-code-string

# Monitoring (optional)
GRAFANA_ADMIN_PASSWORD=your-secure-grafana-password
```

**Frontend (.env.production):**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GA_TRACKING_ID=your-analytics-id
```

## 🚀 Step-by-Step Deployment

### Step 1: Set Up Hostinger VPS/Cloud Server

1. **Purchase Hostinger Plan**
   - Go to [Hostinger.com](https://www.hostinger.com)
   - Choose VPS or Cloud hosting plan (recommended: 2GB RAM minimum)
   - Select Ubuntu 22.04 LTS as OS

2. **Access Your Server**
   ```bash
   # Connect via SSH (use the credentials from Hostinger email)
   ssh root@your-server-ip
   ```

3. **Update System**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

4. **Install Docker and Docker Compose**
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER

   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose

   # Logout and login again for Docker group changes
   exit
   ssh root@your-server-ip
   ```

### Step 2: Upload Project Files

1. **Clone Repository**
   ```bash
   # Install Git if not present
   sudo apt install git -y

   # Clone your repository
   git clone https://github.com/yourusername/trixtech-booking-system.git
   cd trixtech-booking-system
   ```

2. **Alternative: Upload via FTP/SFTP**
   - Use Hostinger's File Manager or SFTP client
   - Upload the entire project directory

### Step 3: Configure Environment Variables

1. **Create Environment Files**
   ```bash
   # Copy environment templates
   cp backend/.env.production backend/.env
   cp frontend/.env.production frontend/.env.local

   # Edit backend environment
   nano backend/.env

   # Edit frontend environment
   nano frontend/.env.local
   ```

2. **Set Secure Permissions**
   ```bash
   chmod 600 backend/.env
   chmod 600 frontend/.env.local
   ```

### Step 4: Deploy with Docker

1. **Build and Start Services**
   ```bash
   # Build and start all services
   docker-compose -f docker-compose.prod.yml up -d --build

   # Check service status
   docker-compose -f docker-compose.prod.yml ps

   # View logs
   docker-compose -f docker-compose.prod.yml logs -f
   ```

2. **Verify Services**
   ```bash
   # Check if services are running
   docker ps

   # Test backend health
   curl http://localhost:5000/api/health

   # Test frontend
   curl http://localhost:3000
   ```

### Step 5: Configure Domain and SSL

1. **Point Domain to Hostinger**
   - In your domain registrar, update nameservers to Hostinger's
   - Or add A record pointing to your server IP

2. **Install Nginx (if not using Docker nginx)**
   ```bash
   sudo apt install nginx -y
   ```

3. **Configure Nginx Reverse Proxy**
   ```nginx
   # Create nginx configuration
   sudo nano /etc/nginx/sites-available/trixtech

   # Add this configuration:
   server {
       listen 80;
       server_name yourdomain.com api.yourdomain.com;

       # Frontend
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # Backend API
       location /api {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

4. **Enable Site and Restart Nginx**
   ```bash
   sudo ln -s /etc/nginx/sites-available/trixtech /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Install SSL Certificate (Let's Encrypt)**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx -y

   # Get SSL certificate
   sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

   # Test renewal
   sudo certbot renew --dry-run
   ```

### Step 6: Database Setup

1. **MongoDB Atlas (Recommended)**
   - Create account at [MongoDB Atlas](https://cloud.mongodb.com)
   - Create cluster and database
   - Create database user
   - Whitelist your server IP (or 0.0.0.0/0 for all)
   - Get connection string and update `MONGODB_URI`

2. **Alternative: Local MongoDB**
   ```bash
   # Install MongoDB on VPS
   sudo apt install mongodb -y
   sudo systemctl start mongodb
   sudo systemctl enable mongodb

   # Update MONGODB_URI to: mongodb://localhost:27017/trixtech_prod
   ```

### Step 7: Email Configuration

1. **Gmail Setup**
   - Enable 2-factor authentication
   - Generate App Password
   - Use App Password in `EMAIL_PASSWORD`

2. **SendGrid Alternative**
   - Create SendGrid account
   - Get API key
   - Update email service configuration

### Step 8: Monitoring Setup (Optional)

1. **Access Grafana**
   - URL: `https://yourdomain.com:3001`
   - Default credentials: admin / your-grafana-password

2. **Configure Dashboards**
   - Add Prometheus as data source
   - Import TRIXTECH monitoring dashboards

3. **Access Prometheus**
   - URL: `https://yourdomain.com:9090`

## 🔧 Post-Deployment Configuration

### Step 9: Seed Initial Data

```bash
# Run database seeding script
docker-compose -f docker-compose.prod.yml exec backend npm run seed
```

### Step 10: Configure Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3001/tcp  # Grafana (optional)
sudo ufw allow 9090/tcp  # Prometheus (optional)

# Enable firewall
sudo ufw enable
```

### Step 11: Backup Setup

1. **Automated Backups**
   ```bash
   # Create backup script
   nano backup.sh
   ```

   ```bash
   #!/bin/bash
   DATE=$(date +%Y%m%d_%H%M%S)
   BACKUP_DIR="/var/backups/trixtech"

   # Create backup directory
   mkdir -p $BACKUP_DIR

   # Backup MongoDB
   docker exec trixtech-mongodb-prod mongodump --db trixtech_prod --out $BACKUP_DIR/database_$DATE

   # Backup uploads
   cp -r /var/lib/docker/volumes/trixtech-booking-system_uploads/_data $BACKUP_DIR/uploads_$DATE

   # Compress backup
   tar -czf $BACKUP_DIR/backup_$DATE.tar.gz $BACKUP_DIR/database_$DATE $BACKUP_DIR/uploads_$DATE

   # Clean up old backups (keep last 7 days)
   find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +7 -delete
   find $BACKUP_DIR -name "database_*" -mtime +7 -delete
   find $BACKUP_DIR -name "uploads_*" -mtime +7 -delete

   echo "Backup completed: $DATE"
   ```

2. **Make Executable and Schedule**
   ```bash
   chmod +x backup.sh
   sudo mv backup.sh /usr/local/bin/

   # Add to crontab for daily backups at 2 AM
   crontab -e
   # Add: 0 2 * * * /usr/local/bin/backup.sh
   ```

## 📊 Monitoring and Maintenance

### Daily Checks
- Monitor application logs: `docker-compose logs -f`
- Check service health: `docker ps`
- Verify SSL certificate expiry

### Weekly Tasks
- Review backup integrity
- Monitor disk usage
- Check for security updates

### Monthly Tasks
- Update Docker images
- Review access logs
- Performance optimization

## 🐛 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check environment variables
docker exec trixtech-backend-prod env
```

**Database connection fails:**
```bash
# Test MongoDB connection
docker exec trixtech-mongodb-prod mongo --eval "db.stats()"
```

**Email not sending:**
```bash
# Check SMTP settings
docker exec trixtech-backend-prod node -e "console.log(process.env.EMAIL_USER)"
```

**SSL certificate issues:**
```bash
# Renew certificates
sudo certbot renew
sudo systemctl reload nginx
```

## 🚀 Access Your Application

- **Frontend:** `https://yourdomain.com`
- **Admin Panel:** `https://yourdomain.com/admin`
- **API Documentation:** `https://api.yourdomain.com/api/docs`
- **Grafana Monitoring:** `https://yourdomain.com:3001` (optional)

## 📞 Support

- Hostinger Support: [support.hostinger.com](https://support.hostinger.com)
- Check application logs for errors
- Monitor Grafana dashboards for system health

---

**🎉 Your TRIXTECH booking system is now live on Hostinger!**