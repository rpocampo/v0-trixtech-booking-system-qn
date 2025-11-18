# 🚀 Deployment Guide - TrixTech Booking System

## 📋 Overview
This comprehensive guide provides multiple deployment options for the TrixTech Web-Based Booking and Reservation System. Choose the option that best fits your infrastructure and expertise level.

## ✅ Prerequisites Checklist

### 🛠️ System Requirements
- [ ] **Node.js 16+** installed on deployment server
- [ ] **MongoDB Database** (local or cloud)
- [ ] **Domain Name** (for production)
- [ ] **SSL Certificate** (Let's Encrypt or purchased)
- [ ] **Email Service** (Gmail, SendGrid, etc.)

### 🔐 Required Environment Variables
Create production `.env` files:

**Backend (.env):**
```env
# Environment
NODE_ENV=production
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/trixtech-prod

# Security
JWT_SECRET=your-32-character-super-secret-key-here

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
ADMIN_EMAIL=admin@yourdomain.com
SENDER_EMAIL=noreply@yourdomain.com
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## 🚀 Quick Deployment Options

### ⚡ Option 1: Vercel + Railway (Recommended - 10 Minutes)
**Best for:** Quick deployment, modern stack, automatic scaling

#### Step 1: Deploy Backend to Railway
1. **Create Railway Account**: https://railway.app
2. **Connect GitHub**: Link your repository
3. **Deploy**: Railway auto-detects Node.js and deploys
4. **Add Environment Variables**: Set all required env vars
5. **Get API URL**: Copy the generated Railway URL

#### Step 2: Deploy Frontend to Vercel
1. **Create Vercel Account**: https://vercel.com
2. **Import Project**: Connect your GitHub repo
3. **Configure Environment**:
   ```
   NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app/api
   ```
4. **Deploy**: Automatic deployment with custom domain

**✅ Result**: Production-ready in 10 minutes!

---

## 🏗️ Advanced Deployment Options

### Option 2: Heroku Deployment (Cloud Platform)

#### Backend Deployment
1. **Create Heroku App**
   ```bash
   heroku create trixtech-backend
   ```

2. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your-mongodb-atlas-uri
   heroku config:set JWT_SECRET=your-jwt-secret
   heroku config:set EMAIL_USER=your-email
   heroku config:set EMAIL_PASSWORD=your-email-password
   heroku config:set ADMIN_EMAIL=admin@trixtech.com
   ```

3. **Deploy Backend**
   ```bash
   cd backend
   git init
   heroku git:remote -a trixtech-backend
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```

#### Frontend Deployment
1. **Deploy to Vercel**
   ```bash
   cd frontend
   vercel --prod
   ```

2. **Update API URLs**
   Update `frontend/lib/api.js` or environment variables to point to Heroku backend URL.

### Option 2: AWS Deployment

#### Using EC2 + MongoDB Atlas
1. **Launch EC2 Instance**
   - Choose Ubuntu 20.04 LTS
   - Configure security groups (ports 22, 80, 443, 5000)

2. **Install Dependencies**
   ```bash
   sudo apt update
   sudo apt install nodejs npm nginx
   ```

3. **Setup Backend**
   ```bash
   cd backend
   npm install --production
   npm run build  # if using TypeScript
   ```

4. **Configure Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. **Setup PM2 for Process Management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "trixtech-backend"
   pm2 startup
   pm2 save
   ```

#### Frontend Deployment
1. **Build for Production**
   ```bash
   cd frontend
   npm run build
   ```

2. **Serve Static Files**
   ```bash
   npm install -g serve
   serve -s build -l 3000
   ```

### Option 3: Docker Deployment

#### Create Dockerfiles

**backend/Dockerfile**
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

**frontend/Dockerfile**
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml**
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/trixtech
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    ports:
      - "3000:80"

  mongo:
    image: mongo:5.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

#### Deploy with Docker
```bash
docker-compose up -d
```

## Database Setup

### MongoDB Atlas (Cloud)
1. Create account at mongodb.com
2. Create cluster and database
3. Get connection string
4. Whitelist IP addresses
5. Create database user

### Local MongoDB
```bash
# Install MongoDB
sudo apt install mongodb

# Start service
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

## Email Configuration

### Gmail Setup
1. Enable 2-factor authentication
2. Generate app password
3. Use app password in EMAIL_PASSWORD

### SendGrid Alternative
1. Create SendGrid account
2. Get API key
3. Update email service to use SendGrid API

## SSL Certificate (HTTPS)

### Using Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Monitoring Setup

### Application Monitoring
```bash
# Install PM2 monitoring
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Server Monitoring
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Error tracking**: Sentry
- **Performance monitoring**: New Relic, DataDog

## Backup Strategy

### Database Backup
```bash
# MongoDB backup script
mongodump --db trixtech --out /path/to/backup/$(date +%Y%m%d)

# Automated backup with cron
0 2 * * * mongodump --db trixtech --out /backup/$(date +\%Y\%m\%d)
```

### File Backup
```bash
# Backup uploaded files
rsync -av /app/uploads /backup/uploads/$(date +%Y%m%d)
```

## Security Checklist

- [ ] Environment variables properly configured
- [ ] Database credentials secured
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Input validation implemented
- [ ] Rate limiting enabled
- [ ] Security headers set
- [ ] Regular security updates scheduled

## Performance Optimization

### Backend
- Enable gzip compression
- Implement caching (Redis)
- Database query optimization
- API rate limiting

### Frontend
- Code splitting
- Image optimization
- CDN integration
- Service worker for caching

## Post-Deployment Checklist

- [ ] Application accessible via domain
- [ ] Database connections working
- [ ] Email notifications functional
- [ ] Admin login working
- [ ] Customer registration working
- [ ] SSL certificate valid
- [ ] Monitoring tools configured
- [ ] Backup procedures tested
- [ ] Performance benchmarks recorded

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 3000/5000 are available
2. **Database connection**: Verify MongoDB URI and credentials
3. **Email failures**: Check SMTP settings and credentials
4. **CORS errors**: Update allowed origins in production
5. **Build failures**: Ensure all dependencies are installed

### Logs
```bash
# View application logs
pm2 logs

# View nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## Support and Maintenance

- Regular security updates
- Monitor error logs
- Performance monitoring
- User feedback collection
- Feature updates based on usage analytics