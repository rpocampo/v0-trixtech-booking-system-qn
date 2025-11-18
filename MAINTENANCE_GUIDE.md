# 🔧 Maintenance & Monitoring Guide - TrixTech Booking System

## 📋 Overview
This comprehensive guide provides procedures for maintaining, monitoring, and troubleshooting your TrixTech booking system. Regular maintenance ensures optimal performance, security, and user experience.

## 🕐 Maintenance Schedule

### 📅 Daily Tasks (15 minutes)
- [ ] **System Health Check**: Verify all services are running
- [ ] **Error Log Review**: Check for new errors or warnings
- [ ] **Backup Verification**: Confirm automated backups completed
- [ ] **Resource Monitoring**: Check CPU, memory, disk usage
- [ ] **User Activity**: Monitor login attempts and booking activity

### 📊 Weekly Tasks (30 minutes)
- [ ] **Performance Analysis**: Review response times and bottlenecks
- [ ] **Security Updates**: Apply system and dependency updates
- [ ] **Database Optimization**: Check query performance and indexes
- [ ] **User Feedback**: Review support tickets and user comments
- [ ] **Analytics Review**: Analyze booking trends and user behavior

### 📈 Monthly Tasks (1 hour)
- [ ] **Comprehensive Backup Test**: Restore from backup to verify integrity
- [ ] **Security Audit**: Full security assessment and vulnerability scan
- [ ] **Performance Benchmarking**: Compare against performance baselines
- [ ] **User Experience Review**: Test all user flows and identify improvements
- [ ] **Documentation Update**: Update guides and procedures as needed

## Daily Maintenance Tasks

### System Health Checks
- [ ] Verify application is running (check server status)
- [ ] Monitor database connections
- [ ] Check disk space usage
- [ ] Review error logs for anomalies
- [ ] Verify email service functionality

### Backup Verification
- [ ] Confirm automated backups completed
- [ ] Test backup restoration procedure
- [ ] Verify backup file integrity

## Weekly Maintenance Tasks

### Performance Monitoring
- [ ] Review application performance metrics
- [ ] Analyze database query performance
- [ ] Check for memory leaks
- [ ] Monitor API response times

### Security Updates
- [ ] Update system packages
- [ ] Update application dependencies
- [ ] Review security logs
- [ ] Check for security vulnerabilities

### Data Management
- [ ] Clean up old log files
- [ ] Archive old booking records (if applicable)
- [ ] Optimize database indexes
- [ ] Review user account statuses

## Monthly Maintenance Tasks

### Comprehensive Review
- [ ] Full system backup test
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] User feedback analysis
- [ ] Feature usage analytics

### Updates and Upgrades
- [ ] Apply security patches
- [ ] Update third-party services
- [ ] Review and update documentation
- [ ] Plan feature enhancements

## 🩺 Quick Health Checks

### ⚡ System Status (2 minutes)
```bash
# Check if services are running
curl http://localhost:5000/api/health

# Check database connection
mongosh --eval "db.stats()" mongodb://localhost:27017/trixtech

# Check application logs
tail -f backend/logs/app.log
tail -f frontend/.next/server.log
```

### 📊 Key Metrics to Monitor
- **Response Time**: API calls should be < 500ms
- **Error Rate**: Should be < 1% of total requests
- **Memory Usage**: Should be < 80% of available RAM
- **Database Connections**: Should be within configured limits
- **Disk Space**: Should have > 20% free space

---

## 🔍 Monitoring Setup

### 📈 Application Monitoring

#### PM2 Process Manager (Production)
```bash
# Install PM2 globally
npm install -g pm2

# Start backend with monitoring
cd backend
pm2 start server.js --name "trixtech-backend"
pm2 monit  # Real-time monitoring dashboard

# Enable log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Save PM2 configuration
pm2 startup
pm2 save
```

#### Built-in Health Monitoring
The system includes automatic health monitoring:
- **Health Endpoint**: `/api/health` - Comprehensive system status
- **Request Tracking**: Automatic request/response monitoring
- **Error Logging**: All errors automatically logged and tracked
- **Performance Metrics**: Real-time performance data collection

#### Key Metrics to Monitor
- CPU usage
- Memory consumption
- Response times
- Error rates
- Database connection pool
- Active user sessions

### Database Monitoring

#### MongoDB Monitoring
```javascript
// Check database status
db.serverStatus()

// Monitor slow queries
db.setProfilingLevel(2, { slowms: 100 })

// View current operations
db.currentOp()
```

#### Key Database Metrics
- Connection count
- Query performance
- Index usage
- Storage utilization
- Replication lag (if applicable)

### External Monitoring Services

#### Uptime Monitoring
- **UptimeRobot**: Free tier for basic uptime monitoring
- **Pingdom**: Advanced monitoring with performance metrics
- **New Relic**: Comprehensive application monitoring

#### Error Tracking
- **Sentry**: Real-time error tracking and alerting
- **Rollbar**: Error monitoring with deployment tracking
- **Bugsnag**: Error reporting with user impact analysis

#### Performance Monitoring
- **Google Analytics**: User behavior and performance
- **Hotjar**: User experience and feedback
- **DataDog**: Infrastructure and application monitoring

## Alert Configuration

### Critical Alerts
- Application downtime
- Database connection failures
- High error rates (>5%)
- Disk space >90% usage
- Memory usage >85%

### Warning Alerts
- Response time degradation
- Increased error rates (1-5%)
- Unusual traffic patterns
- Failed backup attempts

### Notification Channels
- Email alerts to administrators
- SMS alerts for critical issues
- Slack/Teams integration for team notifications

## 🚨 Quick Troubleshooting

### ⚡ Common Issues & Quick Fixes

#### 🔴 Application Won't Start
```bash
# Check what's wrong
pm2 logs trixtech-backend --lines 50

# Check environment variables
cat backend/.env | grep -E "(PORT|MONGO|JWT)"

# Verify Node.js version
node --version  # Should be 16+

# Check port conflicts
netstat -tlnp | grep :5000
lsof -i :5000

# Restart service
pm2 restart trixtech-backend
```

#### 🔴 Database Connection Failed
```bash
# Test database connection
mongosh mongodb://localhost:27017/trixtech --eval "db.stats()"

# Check MongoDB service
sudo systemctl status mongod  # Linux
brew services list | grep mongodb  # Mac

# Restart database
sudo systemctl restart mongod  # Linux
brew services restart mongodb-community  # Mac
```

#### 🔴 High Memory/CPU Usage
```bash
# Check resource usage
pm2 monit
htop  # or top

# Restart application
pm2 restart trixtech-backend

# Check for memory leaks
pm2 reloadLogs
grep "memory" ~/.pm2/logs/trixtech-backend-out.log
```

#### 🔴 Users Can't Login
```bash
# Check JWT secret
grep JWT_SECRET backend/.env

# Verify user exists in database
mongosh mongodb://localhost:27017/trixtech --eval "db.users.find().limit(5)"

# Check authentication logs
grep "login\|auth" backend/logs/app.log
```

#### 🔴 Emails Not Sending
```bash
# Check email configuration
grep EMAIL backend/.env

# Test email service
curl -X POST http://localhost:5000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check email logs
grep "email\|mail" backend/logs/app.log
```

#### Database Connection Issues
```bash
# Test database connection
mongosh mongodb://localhost:27017/trixtech

# Check MongoDB service
sudo systemctl status mongod

# Verify connection string
mongo --eval "db.stats()"
```

#### Email Delivery Problems
```bash
# Test email configuration
node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransporter({...});
transporter.verify((error, success) => {
  console.log(error || 'Email service ready');
});
"
```

#### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart trixtech-backend

# Check for memory leaks
npm install -g memwatch-next
```

#### Slow Performance
```bash
# Check system resources
top
htop

# Analyze database queries
db.currentOp()

# Check network latency
ping google.com

# Review application logs for bottlenecks
tail -f logs/app.log
```

### Performance Optimization

#### Database Optimization
```javascript
// Create indexes for frequently queried fields
db.bookings.createIndex({ customerId: 1, status: 1 })
db.bookings.createIndex({ serviceId: 1, bookingDate: 1 })

// Analyze query performance
db.bookings.find({ status: "confirmed" }).explain("executionStats")
```

#### Application Optimization
```javascript
// Enable compression
const compression = require('compression');
app.use(compression());

// Implement caching
const cache = require('memory-cache');
// Cache frequently accessed data

// Optimize API responses
app.use(express.json({ limit: '10mb' }));
```

## 💾 Backup & Recovery

### 🔄 Automated Backup Setup
```bash
# Create backup directory
sudo mkdir -p /backup/trixtech
sudo chown $(whoami):$(whoami) /backup/trixtech

# Create automated backup script
cat > ~/backup-trixtech.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/trixtech"

# Database backup
mongodump --db trixtech --out $BACKUP_DIR/db_$DATE

# File backup (if you have uploads)
if [ -d "/app/uploads" ]; then
    tar -czf $BACKUP_DIR/files_$DATE.tar.gz /app/uploads
fi

# Environment files backup
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /app/backend/.env

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "db_*" -mtime +7 -delete
find $BACKUP_DIR -name "files_*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "config_*.tar.gz" -mtime +7 -delete

echo "✅ Backup completed: $DATE"
EOF

chmod +x ~/backup-trixtech.sh
```

### ⏰ Schedule Daily Backups
```bash
# Add to crontab for daily backups at 2 AM
crontab -e

# Add this line:
0 2 * * * ~/backup-trixtech.sh >> ~/backup-trixtech.log 2>&1
```

### 🔧 Manual Backup Commands
```bash
# Quick database backup
mongodump --db trixtech --out ./backup_$(date +%Y%m%d)

# Quick file backup
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Backup everything
tar -czf full_backup_$(date +%Y%m%d).tar.gz . --exclude=node_modules --exclude=.git
```

### 🔄 Recovery Procedures
```bash
# Restore database
mongorestore --db trixtech ./backup/db_latest

# Restore files
tar -xzf ./backup/files_latest.tar.gz -C /app/uploads

# Verify restoration
mongosh mongodb://localhost:27017/trixtech --eval "db.stats()"
```

### Backup Verification
```bash
# Test database restore
mongorestore --db trixtech_test /backup/trixtech/db_latest

# Test file integrity
tar -tzf /backup/trixtech/files_latest.tar.gz
```

### Disaster Recovery Plan
1. **Immediate Response**
   - Assess damage scope
   - Notify stakeholders
   - Activate backup systems

2. **Recovery Steps**
   - Restore from latest backup
   - Verify data integrity
   - Test application functionality
   - Communicate with users

3. **Post-Recovery**
   - Analyze root cause
   - Update recovery procedures
   - Implement preventive measures

## Security Maintenance

### Regular Security Tasks
- [ ] Update system packages monthly
- [ ] Review firewall rules
- [ ] Monitor for suspicious activity
- [ ] Update SSL certificates
- [ ] Review user access permissions

### Security Monitoring
```bash
# Check for failed login attempts
grep "Failed login" /var/log/auth.log

# Monitor file integrity
aide --check

# Review sudo usage
cat /var/log/auth.log | grep sudo
```

## User Support Procedures

### Support Ticket Handling
1. **Initial Response**: Acknowledge within 1 hour
2. **Investigation**: Gather relevant logs and data
3. **Resolution**: Implement fix or workaround
4. **Communication**: Keep user informed of progress
5. **Follow-up**: Confirm resolution and gather feedback

### Common User Issues
- Password reset problems
- Booking confirmation delays
- Payment processing issues
- Mobile app compatibility
- Feature requests

## Update Procedures

### Application Updates
```bash
# Create backup before update
./backup-trixtech.sh

# Update application
cd /app
git pull origin main
npm install --production
pm2 restart trixtech-backend

# Verify functionality
curl http://localhost:5000/api/health
```

### Database Migrations
```javascript
// Migration script example
const mongoose = require('mongoose');

// Connect to database
// Perform schema updates
// Update existing documents
// Verify changes
```

## Reporting and Analytics

### System Health Reports
- Daily uptime reports
- Weekly performance summaries
- Monthly user activity reports
- Quarterly security assessments

### Business Metrics
- Booking volume trends
- Revenue analytics
- User engagement metrics
- Service popularity analysis

## Emergency Contacts

### Technical Team
- **Lead Developer**: [contact info]
- **DevOps Engineer**: [contact info]
- **Database Administrator**: [contact info]

### External Services
- **Hosting Provider**: [support contact]
- **Database Provider**: [support contact]
- **Email Service**: [support contact]

### Escalation Procedures
1. **Level 1**: On-call engineer
2. **Level 2**: Development team lead
3. **Level 3**: Management and external consultants

## 📚 Documentation & Support

### 🔄 Regular Updates
- [ ] **Review this guide** quarterly for accuracy
- [ ] **Document new features** as they are added
- [ ] **Update emergency contacts** annually
- [ ] **Maintain change log** for all system updates
- [ ] **Archive old procedures** when replaced

### 🆘 Support Resources

#### 📞 Emergency Contacts
- **Primary Admin**: [Your Name] - [Phone] - [Email]
- **Technical Lead**: [Dev Name] - [Phone] - [Email]
- **Hosting Provider**: [Provider Support] - [Support Phone]
- **Database Provider**: [DB Support] - [Support Email]

#### 📖 Additional Resources
- **System Documentation**: See SETUP_GUIDE.md, DEPLOYMENT_GUIDE.md
- **API Documentation**: Visit `/api/docs` when running
- **Health Monitoring**: Check `/api/health` endpoint
- **Logs Location**: `backend/logs/` and PM2 logs

#### 🎯 Quick Reference Commands
```bash
# System status
curl http://localhost:5000/api/health

# View logs
pm2 logs trixtech-backend --lines 100

# Restart services
pm2 restart trixtech-backend

# Database backup
~/backup-trixtech.sh

# Check disk space
df -h

# Monitor resources
pm2 monit
```

---

## 🎉 Maintenance Summary

**Your TrixTech system is now equipped with:**

✅ **Automated Health Monitoring** - Real-time system status tracking
✅ **Comprehensive Logging** - Detailed error and performance logs
✅ **Automated Backups** - Daily database and file backups
✅ **Performance Tracking** - Response time and resource monitoring
✅ **Security Updates** - Regular dependency and system updates
✅ **Quick Troubleshooting** - Fast diagnosis and resolution guides
✅ **Scalability Ready** - Monitoring for growth and peak loads

**Remember:** Regular maintenance = Happy users! Schedule time weekly for system checks and monthly for comprehensive reviews.

**🚀 Stay proactive, monitor regularly, and your booking system will run smoothly!**