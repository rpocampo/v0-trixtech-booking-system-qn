# 🚀 TRIXTECH Booking System - Complete Setup Guide

## ⚡ Quick Start (Recommended - 2 Minutes)

### 🚀 One-Command Setup & Start

**Windows:**
```cmd
# Install everything and start
npm run quickstart

# OR step by step:
npm install          # Install all dependencies
npm run dev         # Start both servers
```

**Mac/Linux:**
```bash
# Install everything and start
npm run quickstart

# OR step by step:
npm install          # Install all dependencies
npm run dev         # Start both servers
```

**That's it!** The system automatically:
- ✅ Installs backend + frontend dependencies
- ✅ Sets up environment files
- ✅ Starts MongoDB (if available)
- ✅ Seeds demo data
- ✅ Launches both servers simultaneously

### 📱 Access Your Application
- 🌐 **Customer Portal**: http://localhost:3000
- 👑 **Admin Dashboard**: http://localhost:3000/admin
- 🔌 **Backend API**: http://localhost:5000/api
- ❤️ **Health Check**: http://localhost:5000/api/health

### 🔑 Demo Accounts
- **👑 Admin**: `admin@trixtech.com` / `admin123`
- **👤 Customer**: `customer@trixtech.com` / `customer123`

### 🛑 Stop the System
```bash
# Press Ctrl+C in the terminal running npm run dev
# OR on Windows: taskkill /f /im node.exe
```

### 🔧 Manual Setup (If Auto-Setup Fails)

**Step 1: Install Dependencies**
```bash
npm run install:all    # Installs both backend and frontend
```

**Step 2: Setup Environment (Auto-handled by setup.bat)**
```bash
npm run setup:env      # Creates .env files from templates
```

**Step 3: Start MongoDB**
- **Windows**: Download MongoDB Compass → Click "Connect"
- **Mac**: `brew services start mongodb-community`
- **Linux**: `sudo systemctl start mongod`

**Step 4: Start Application**
```bash
npm run dev            # Starts both backend and frontend
```

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- ✅ **Node.js 18+** installed (`node --version`) - Recommended for Next.js 16 and React 19
- ✅ **npm** installed (`npm --version`)
- ✅ **MongoDB** installed and running
- ✅ **Git** (for cloning the repository)

## 🔧 Detailed Manual Setup

### Step 1: Install Dependencies
```bash
# Backend dependencies (Express.js API)
cd backend
npm install

# Frontend dependencies (Next.js React App)
cd ../frontend
npm install

# Return to project root
cd ..
```

### Step 2: Environment Configuration

**Backend (.env file):**
```bash
cd backend

# Copy example file
cp .env.example .env

# Edit with your values
nano .env  # or use any text editor
```

**Required Backend Environment Variables:**
```env
# Database
MONGODB_URI=mongodb://localhost:27017/trixtech

# Security
JWT_SECRET=your-super-secure-random-key-here-min-32-chars

# Email Configuration (Required for OTP functionality)
# Gmail SMTP (recommended)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
SENDER_EMAIL=noreply@trixtech.com

# Alternative Email Providers:
# Outlook/Hotmail
# EMAIL_HOST=smtp-mail.outlook.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@outlook.com
# EMAIL_PASSWORD=your-app-password

# Yahoo Mail
# EMAIL_HOST=smtp.mail.yahoo.com
# EMAIL_PORT=587
# EMAIL_USER=your-email@yahoo.com
# EMAIL_PASSWORD=your-app-password

# Custom SMTP
# EMAIL_HOST=your-smtp-server.com
# EMAIL_PORT=587
# EMAIL_USER=your-smtp-username
# EMAIL_PASSWORD=your-smtp-password

# Admin Configuration
ADMIN_EMAIL=admin@trixtech.com

# Server
PORT=5000
NODE_ENV=development
```

**Frontend (.env.local file):**
```bash
cd frontend

# Copy example file
cp .env.example .env.local

# Edit configuration
nano .env.local  # or use any text editor
```

**Required Frontend Environment Variables:**
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Optional: Analytics, etc.
# NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=your-ga-id
```

### Step 3: Setup Database (MongoDB)

**Option A: MongoDB Compass (Easiest - Windows/Mac/Linux)**
1. Download MongoDB Compass: https://www.mongodb.com/products/tools/compass
2. Install and open the application
3. Click **"Connect"** (uses default local connection)
4. ✅ MongoDB is now running!

**Option B: Command Line Setup**

**macOS (Homebrew):**
```bash
# Install MongoDB
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB service
brew services start mongodb-community

# Verify it's running
brew services list | grep mongodb
```

**Windows:**
```cmd
# Download MongoDB Community Server from:
# https://www.mongodb.com/try/download/community

# Install and start as Windows Service
# OR use MongoDB Compass (recommended)
```

**Linux (Ubuntu/Debian):**
```bash
# Install MongoDB
sudo apt update
sudo apt install mongodb

# Start service
sudo systemctl start mongod
sudo systemctl enable mongod

# Check status
sudo systemctl status mongod
```

**Verify Database Connection:**
```bash
# Test connection (optional)
mongosh mongodb://localhost:27017/trixtech
# Type: db.stats() then exit
```

### Step 4: Start the Application

**Important:** Keep both terminals running simultaneously!

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev
```
*Expected output: "TRIXTECH Backend running on port 5000"*

**Terminal 2 - Frontend App (New Terminal):**
```bash
cd frontend
npm run dev
```
*Expected output: "Ready - started server on 0.0.0.0:3000"*

## 🎉 Access Your Application

### Main Application
- 🌐 **Customer Portal**: http://localhost:3000
- 🔧 **Admin Dashboard**: http://localhost:3000/admin
- 📱 **Mobile Friendly**: Works on all devices!

### API Endpoints
- 🔌 **Backend API**: http://localhost:5000/api
- ❤️ **Health Check**: http://localhost:5000/api/health
- 📊 **System Status**: http://localhost:5000/api/health (shows detailed metrics)

### Demo Accounts
**👑 Admin Account:**
- Email: `admin@trixtech.com`
- Password: `admin123`

**👤 Customer Account:**
- Email: `customer@trixtech.com`
- Password: `customer123`

## Demo Credentials

**Admin Account:**
- Email: admin@trixtech.com
- Password: admin123

**Customer Account:**
- Email: customer@trixtech.com
- Password: customer123

## 🔧 Troubleshooting Guide

### 🚨 Common Issues & Solutions

#### ❌ "MongoDB Connection Error"
**Symptoms:** "MongoNetworkError" or "ECONNREFUSED"
**Solutions:**
```bash
# Check if MongoDB is running
# Windows: Check MongoDB Compass is connected
# Mac: brew services list | grep mongodb
# Linux: sudo systemctl status mongod

# Test connection manually
mongosh mongodb://localhost:27017/trixtech

# If connection fails, restart MongoDB
# Mac: brew services restart mongodb-community
# Linux: sudo systemctl restart mongod
```

#### ❌ "Port Already in Use"
**Symptoms:** "EADDRINUSE" error
**Solutions:**
```bash
# Find what's using the port
# Windows: netstat -ano | findstr :5000
# Mac/Linux: lsof -i :5000

# Kill the process or change ports
# Backend: Edit backend/.env PORT=5001
# Frontend: npm run dev -- -p 3001
```

#### ❌ "Module Not Found" or "Cannot resolve dependency"
**Symptoms:** Import/build errors
**Solutions:**
```bash
# Clean and reinstall (do this in BOTH backend AND frontend folders)
cd backend  # or cd frontend
rm -rf node_modules package-lock.json
npm install

# If still failing, check Node.js version
node --version  # Should be 16+
```

#### ❌ "JWT Token Invalid" or Authentication Issues
**Symptoms:** Can't login, API returns 401
**Solutions:**
```bash
# Check JWT_SECRET in backend/.env
# Must be at least 32 characters long
# Example: my-super-secret-jwt-key-minimum-32-chars

# Regenerate if needed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### ❌ Email Notifications Not Working
**Symptoms:** No emails sent, but system works
**Solutions:**
```bash
# Email is REQUIRED for OTP functionality
# To enable Gmail SMTP:
# 1. Enable 2-factor authentication on Gmail
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Use App Password (not regular password) in EMAIL_PASSWORD
# 4. Test with: node test_otp.js
```

#### ❌ OTP Emails Not Sending
**Symptoms:** Registration fails at OTP step
**Solutions:**
```bash
# Check email configuration
cd backend
node -e "
const { initializeEmailService } = require('./utils/emailService');
initializeEmailService();
console.log('Email service initialized');
"

# Test OTP functionality
node ../test_otp.js

# Check email credentials in .env file
# Ensure EMAIL_USER and EMAIL_PASSWORD are correct
```

#### ❌ Frontend Shows "Loading..." Forever
**Symptoms:** Page loads but shows loading spinner
**Solutions:**
```bash
# Check backend is running on port 5000
curl http://localhost:5000/api/health

# Check NEXT_PUBLIC_API_URL in frontend/.env.local
# Should be: http://localhost:5000/api

# Check browser console for CORS errors
```

### 🛠️ Advanced Troubleshooting

#### Check System Health
```bash
# Backend health check
curl http://localhost:5000/api/health

# Database connection test
cd backend && node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/trixtech')
  .then(() => console.log('✅ DB Connected'))
  .catch(err => console.log('❌ DB Error:', err.message));
"
```

#### View Application Logs
```bash
# Backend logs (in backend terminal, press Ctrl+C to stop and see logs)
# Frontend logs (in frontend terminal, check for build errors)

# Check for specific errors
grep -r "Error" backend/logs/  # if log files exist
```

#### Reset Everything (Last Resort)
```bash
# Stop all processes
# Delete databases and start fresh
cd backend
rm -rf node_modules package-lock.json
npm install

cd ../frontend
rm -rf node_modules package-lock.json .next
npm install

# Reset database (WARNING: deletes all data)
mongosh mongodb://localhost:27017/trixtech --eval "db.dropDatabase()"
```

## 🚀 Next Steps After Setup

### 🎯 Test the System
1. **Login as Admin** → Manage services and inventory
2. **Login as Customer** → Browse services and make bookings
3. **Test Notifications** → Check email delivery
4. **Verify Reports** → Check admin analytics
5. **Test Auto-Updates** → Check real-time data synchronization

### 🔄 Development Workflow
```bash
# Make changes to code
# Backend changes: Restart backend server
# Frontend changes: Auto-reload (no restart needed)

# Check health after changes
curl http://localhost:5000/api/health

# Test auto-updating features
# Frontend will automatically refresh data every 30 seconds
# Real-time updates via WebSocket for instant notifications
```

### ⚡ Auto-Updating Features

The system includes several auto-updating capabilities:

#### 🔄 Real-Time Data Synchronization
- **Auto-refresh**: Services and bookings update every 30 seconds
- **WebSocket updates**: Instant notifications for status changes
- **Inventory sync**: Real-time stock level updates
- **Booking status**: Automatic status updates without page refresh

#### 📱 Auto-Update Service
- **Version checking**: Automatic check for application updates
- **Background sync**: Data synchronization with server
- **Optimistic updates**: Immediate UI feedback with server sync
- **Error recovery**: Automatic retry on failed updates

#### 🎛️ Configuration
```javascript
// Auto-refresh intervals (customizable)
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds
const DATA_SYNC_INTERVAL = 300000;   // 5 minutes
const UPDATE_CHECK_INTERVAL = 3600000; // 1 hour
```

#### 🔧 Manual Controls
```javascript
// Force refresh data
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
const { refresh } = useAutoRefresh({ interval: 30000 });

// Check for updates
import AutoUpdateService from '@/services/autoUpdateService';
const updateService = AutoUpdateService.getInstance();
await updateService.checkForUpdates();
```

### 📈 Production Deployment
When ready for production:
1. **Secure JWT_SECRET** (32+ characters)
2. **Setup MongoDB Atlas** (cloud database)
3. **Configure domain** and SSL certificates
4. **Deploy to Vercel** (frontend) + **Railway/Render** (backend)
5. **Enable email notifications**

## 📞 Support & Resources

### 🆘 Getting Help
- **Check Logs**: Both backend and frontend terminals show errors
- **Health Check**: Visit `/api/health` for system status
- **Documentation**: See other guide files in the project

### 📚 Additional Resources
- **MongoDB Docs**: https://docs.mongodb.com
- **Next.js Docs**: https://nextjs.org/docs
- **Express.js Docs**: https://expressjs.com
- **Node.js Docs**: https://nodejs.org/docs

### 🎯 Quick Commands Reference
```bash
# Start everything
./setup.sh          # Linux/Mac
setup.bat          # Windows

# Check status
curl http://localhost:5000/api/health

# View logs
# Backend terminal: Shows API requests
# Frontend terminal: Shows build status

# Stop everything
# Ctrl+C in both terminals
```

---

**🎉 Congratulations!** Your TrixTech booking system is now running. Start exploring the features and customizing it for your needs!
