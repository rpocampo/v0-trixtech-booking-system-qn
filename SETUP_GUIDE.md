# 🚀 TRIXTECH Booking System - Complete Setup Guide

Welcome to TRIXTECH! This guide will help you get the booking system running on your computer in just a few minutes.

## 📋 Before You Start - Prerequisites

Make sure you have these installed on your computer:

### Required Software
- **Node.js** (version 16 or higher) - [Download here](https://nodejs.org/)
- **MongoDB Community Edition** - [Download here](https://www.mongodb.com/try/download/community)
- **Git** (optional, for cloning the repository)

### Verify Installation
Open a terminal/command prompt and run:
```bash
node --version    # Should show v16.x.x or higher
npm --version     # Should show a version number
```

---

## ⚡ Quick Start (Recommended)

### Option 1: One-Click Setup (Windows)
```bash
# Double-click setup.bat or run in terminal
setup.bat
```

### Option 2: One-Command Setup (Mac/Linux)
```bash
# Make script executable and run
chmod +x setup.sh
./setup.sh
```

**What this does:** Automatically installs all required packages for both frontend and backend.

---

## 🔧 Manual Setup (Step-by-Step)

If the automated scripts don't work, follow these steps:

### Step 1: Download the Project
```bash
# Clone or download the project files
git clone <your-repository-url>
cd trixtech-booking-system
```

### Step 2: Install Dependencies

#### Backend Setup
```bash
# Navigate to backend folder
cd backend

# Install backend packages
npm install

# Go back to root folder
cd ..
```

#### Frontend Setup
```bash
# Navigate to frontend folder
cd frontend

# Install frontend packages
npm install

# Go back to root folder
cd ..
```

### Step 3: Configure Environment Variables

#### Backend Configuration
1. Go to the `backend` folder
2. Copy the example file: `cp .env.example .env`
3. Open `.env` in a text editor and update these values:

```env
# Database connection
MONGODB_URI=mongodb://localhost:27017/trixtech

# Security (generate a random string for production)
JWT_SECRET=your_super_secret_key_here_change_this

# Email settings (optional - leave blank to disable)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
```

#### Frontend Configuration
1. Go to the `frontend` folder
2. Copy the example file: `cp .env.example .env.local`
3. Open `.env.local` and verify:

```env
# API connection (points to your backend)
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Step 4: Start MongoDB Database

#### Windows Users:
1. Download and install [MongoDB Compass](https://www.mongodb.com/products/tools/compass)
2. Open MongoDB Compass
3. Click "Connect" to start the local database

#### Mac Users (with Homebrew):
```bash
# Start MongoDB service
brew services start mongodb-community
```

#### Linux Users:
```bash
# Start MongoDB service
sudo systemctl start mongod
```

### Step 5: Start the Application

#### Terminal 1: Start Backend Server
```bash
# Navigate to backend folder
cd backend

# Start development server
npm run dev
```
✅ **Success:** You'll see "Server running on port 5000"

#### Terminal 2: Start Frontend Server
```bash
# Navigate to frontend folder
cd frontend

# Start development server
npm run dev
```
✅ **Success:** You'll see "Ready - started server on 0.0.0.0:3000"

---

## 🌐 Access Your Application

Once both servers are running, open your browser and visit:

- **📱 Main Application:** http://localhost:3000
- **🔧 Backend API:** http://localhost:5000/api
- **💚 Health Check:** http://localhost:5000/api/health

---

## 🔍 Troubleshooting Common Issues

### ❌ "MongoDB Connection Error"
**Symptoms:** Application won't start, shows database connection errors

**Solutions:**
- Make sure MongoDB is running (check step 4 above)
- Verify `MONGODB_URI` in `backend/.env` is correct
- Default should be: `mongodb://localhost:27017/trixtech`

### ❌ "Port Already in Use"
**Symptoms:** Error saying port 3000 or 5000 is busy

**Solutions:**
- **For Backend:** Change PORT in `backend/.env` to something else (like 5001)
- **For Frontend:** Run `npm run dev -- -p 3001` in frontend folder

### ❌ "Module Not Found" or "Cannot find package"
**Symptoms:** npm install fails or app won't start

**Solutions:**
```bash
# In the problematic folder (backend or frontend):
rm -rf node_modules package-lock.json
npm install
```

### ❌ "Email Notifications Not Working"
**Symptoms:** No emails being sent

**Solutions:**
- Email is **optional** - the app works fine without it
- To enable: Get an "App Password" from your Gmail account
- Update `EMAIL_USER` and `EMAIL_PASSWORD` in `backend/.env`

### ❌ "Command not found" errors
**Symptoms:** Terminal doesn't recognize commands

**Solutions:**
- Make sure Node.js and npm are installed (check prerequisites)
- Try restarting your terminal/command prompt
- On Windows, use Command Prompt or PowerShell as Administrator

---

## 🚀 Going Live - Production Deployment

When you're ready to deploy to the internet:

### 1. Security First
- Change `JWT_SECRET` to a long random string
- Never use the default MongoDB connection in production

### 2. Database
- Use [MongoDB Atlas](https://www.mongodb.com/atlas) instead of local MongoDB
- Update `MONGODB_URI` with your Atlas connection string

### 3. Environment Variables
- Set `NODE_ENV=production`
- Update all URLs to your production domain
- Configure proper email settings

### 4. Hosting Recommendations
- **Frontend:** Vercel, Netlify, or Heroku
- **Backend:** Railway, Render, or DigitalOcean
- **Database:** MongoDB Atlas

---

## 📞 Need Help?

1. **Check the logs** in both terminal windows for error messages
2. **Verify all steps** above were completed correctly
3. **Test each component** individually:
   - MongoDB: Try connecting with MongoDB Compass
   - Backend: Visit http://localhost:5000/api/health
   - Frontend: Check if npm run dev works

### Still stuck?
- Check the main README.md for more details
- Look at QUICK_START.md for alternative instructions
- Search for your specific error message online

---

**🎉 Congratulations!** Your TRIXTECH booking system should now be running smoothly. Happy coding! 🚀
