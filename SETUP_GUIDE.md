# 🚀 TRIXTECH Booking System - Complete Setup Guide

## ⚡ Quick Start (Recommended - 5 Minutes)

### Option 1: One-Command Automated Setup

**Windows:**
```cmd
setup.bat
```

**Mac/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

This automatically installs all dependencies, sets up environment files, and starts the system!

### Option 2: Manual Setup (If Scripts Don't Work)

**Step 1: Install Dependencies**
```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

**Step 2: Setup Environment**
```bash
# Backend environment
cd backend
copy .env.example .env  # Windows
# OR
cp .env.example .env    # Mac/Linux

# Frontend environment
cd ../frontend
copy .env.example .env.local  # Windows
# OR
cp .env.example .env.local    # Mac/Linux
```

**Step 3: Start MongoDB**
Choose your system:

**Windows (MongoDB Compass):**
- Download from: https://www.mongodb.com/products/tools/compass
- Click "Connect" to start local MongoDB

**Mac (Homebrew):**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Step 4: Start the Application**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (new terminal)
cd frontend
npm run dev
```

**Step 5: Access Your App**
- 🌐 **Frontend**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:5000/api
- ❤️ **Health Check**: http://localhost:5000/api/health

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- ✅ **Node.js 16+** installed (`node --version`)
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

# Email (Optional - leave blank to disable)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587

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
# Email is OPTIONAL - system works without it
# To enable Gmail:
# 1. Enable 2-factor authentication on Gmail
# 2. Generate App Password: https://myaccount.google.com/apppasswords
# 3. Use App Password (not regular password) in EMAIL_PASSWORD
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

### 🔄 Development Workflow
```bash
# Make changes to code
# Backend changes: Restart backend server
# Frontend changes: Auto-reload (no restart needed)

# Check health after changes
curl http://localhost:5000/api/health
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
