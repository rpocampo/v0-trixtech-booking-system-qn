# TRIXTECH Production Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying the TRIXTECH booking system to production environments.

## Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- MongoDB Atlas account or MongoDB server
- Domain name and SSL certificate
- SMTP service (Gmail, SendGrid, etc.)
- Cloud hosting provider (AWS, DigitalOcean, etc.)

## Quick Start with Docker

### 1. Environment Setup
```bash
# Clone repository
git clone <repository-url>
cd trixtech-booking-system

# Copy environment files
cp backend/.env.production backend/.env
cp frontend/.env.production frontend/.env.local

# Edit environment variables (see sections below)
nano backend/.env
nano frontend/.env.local
```

### 2. Production Deployment
```bash
# Build and deploy with Docker Compose
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Access Application
- Frontend: `https://yourdomain.com`
- Backend API: `https://api.yourdomain.com`
- Admin Panel: `https://yourdomain.com/admin`
- Monitoring: `https://yourdomain.com:3001` (Grafana)

## Environment Configuration

### Backend Environment Variables
```bash
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trixtech_prod

# Security
JWT_SECRET=your-super-secure-jwt-secret-here
BCRYPT_ROUNDS=12

# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
ADMIN_EMAIL=admin@yourdomain.com

# GCash Payment
GCASH_QR_CODE=your-gcash-qr-code-string

# Server
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### Frontend Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GA_TRACKING_ID=your-analytics-id
```

## Database Setup

### MongoDB Atlas (Recommended)
1. Create MongoDB Atlas cluster
2. Create database user with read/write permissions
3. Whitelist IP addresses (0.0.0.0/0 for development)
4. Get connection string and update `MONGODB_URI`

### Local MongoDB
```bash
# Install MongoDB
sudo apt update && sudo apt install -y mongodb

# Start service
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

## Email Configuration

### Gmail SMTP
1. Enable 2-factor authentication
2. Generate App Password
3. Use App Password in `EMAIL_PASSWORD`

### SendGrid
```bash
# Install SendGrid
npm install @sendgrid/mail

# Configure API key
SENDGRID_API_KEY=your-sendgrid-api-key
```

## SSL Configuration

### Let's Encrypt (Free SSL)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Manual SSL
```bash
# Place certificates in nginx/ssl/
ssl_certificate /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
```

## Monitoring Setup

### Grafana Dashboards
1. Access Grafana at `https://yourdomain.com:3001`
2. Default credentials: admin/admin
3. Add Prometheus as data source
4. Import TRIXTECH dashboard JSON

### Application Monitoring
- Health checks: `/api/health`
- Metrics endpoint: `/api/metrics`
- Error logging: Check `/app/logs/` directory

## Backup Strategy

### Automated Backups
```bash
# Setup cron job for daily backups
chmod +x scripts/setup-backup-cron.sh
sudo ./scripts/setup-backup-cron.sh

# Manual backup
./scripts/backup.sh
```

### Backup Locations
- Database: `/var/backups/trixtech/database/`
- Files: `/var/backups/trixtech/uploads/`
- Retention: 30 days

## Testing

### Run Test Suite
```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests (when implemented)
cd ../frontend
npm test
```

### Manual Testing Checklist
- [ ] User registration and login
- [ ] Service browsing and booking
- [ ] Payment processing with QR codes
- [ ] Admin dashboard functionality
- [ ] Email notifications
- [ ] Real-time notifications
- [ ] Mobile responsiveness

## Performance Optimization

### Database Indexing
```javascript
// Ensure these indexes exist
db.bookings.createIndex({ customerId: 1, status: 1 });
db.payments.createIndex({ bookingId: 1 });
db.services.createIndex({ category: 1, isAvailable: 1 });
```

### Caching Strategy
- Redis for session storage
- CDN for static assets
- Database query result caching

### Scaling Considerations
- Horizontal scaling with load balancer
- Database read replicas
- Microservices architecture for high traffic

## Security Checklist

### Pre-deployment
- [ ] Change all default passwords
- [ ] Enable HTTPS everywhere
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable CORS properly
- [ ] Validate input sanitization

### Post-deployment
- [ ] Regular security updates
- [ ] Monitor for vulnerabilities
- [ ] Log analysis for suspicious activity
- [ ] Regular backup verification

## Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check environment variables
docker exec trixtech-backend-prod env
```

**Database connection fails:**
```bash
# Test connection
docker exec trixtech-backend-prod mongo mongodb://mongodb:27017/trixtech_prod
```

**Email not sending:**
```bash
# Check SMTP settings
docker exec trixtech-backend-prod node -e "console.log(process.env)"
```

## Support and Maintenance

### Regular Tasks
- Daily: Monitor error logs
- Weekly: Review backup integrity
- Monthly: Security updates and patches
- Quarterly: Performance optimization

### Emergency Contacts
- System Administrator: admin@yourdomain.com
- Database Issues: dba@yourdomain.com
- Security Incidents: security@yourdomain.com

---

## Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] Database connection tested
- [ ] Email service configured
- [ ] Backup scripts tested
- [ ] Monitoring dashboards set up

### Deployment
- [ ] Docker images built successfully
- [ ] Services start without errors
- [ ] Application accessible via HTTPS
- [ ] Admin panel functional
- [ ] User registration works

### Post-deployment
- [ ] Automated backups running
- [ ] Monitoring alerts configured
- [ ] SSL certificates auto-renewing
- [ ] Performance benchmarks established
- [ ] Documentation updated

**🎉 Your TRIXTECH system is now production-ready!**