# ⚡ TRIXTECH - Quick Start Guide (2 Minutes!)

## 🚀 One-Command Installation

**Choose your operating system:**

### 🪟 Windows
```cmd
setup.bat
```

### 🍎 Mac/Linux
```bash
chmod +x setup.sh
./setup.sh
```

**That's it!** 🎉 Your booking system will be running in under 2 minutes!

---

## 📋 Manual Setup (If Auto-Setup Fails)

### Step 1: Install Dependencies
```bash
# Backend (API server)
cd backend
npm install

# Frontend (React app)
cd ../frontend
npm install

cd ..  # Return to project root
```

### Step 2: Setup Environment
```bash
# Backend config
cd backend
cp .env.example .env

# Frontend config
cd ../frontend
cp .env.example .env.local
```

### Step 3: Start Database
**Easiest Option:** Download [MongoDB Compass](https://mongodb.com/products/tools/compass) and click "Connect"

### Step 4: Start Application
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend (new terminal)
cd frontend
npm run dev
```

### Step 5: Access Your App
- 🌐 **Main App**: http://localhost:3000
- 🔧 **Admin Panel**: http://localhost:3000/admin

---

## 🔑 Demo Accounts

**👑 Admin Access:**
- Email: `admin@trixtech.com`
- Password: `admin123`

**👤 Customer Access:**
- Email: `customer@trixtech.com`
- Password: `customer123`

---

## ✨ What You Get

### 🎯 Core Features
- ✅ **User Management** - Registration, login, profiles with role-based access
- ✅ **Advanced Booking** - Custom date/time picker with AM/PM selection
- ✅ **Real-time Availability** - Live inventory checking and booking validation
- ✅ **Smart Reservations** - Queue system for unavailable items
- ✅ **Payment Processing** - GCash integration with secure transactions
- ✅ **Admin Dashboard** - Comprehensive management with analytics
- ✅ **Real-time Notifications** - Live updates via Socket.IO
- ✅ **Email/SMS System** - Template-based notifications
- ✅ **Recommendation Engine** - AI-powered service suggestions
- ✅ **System Monitoring** - Health checks and error tracking
- ✅ **Mobile Responsive** - Optimized for all devices

### 🏗️ Technical Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, Socket.IO, MongoDB
- **Database**: MongoDB with advanced querying and transactions
- **Real-time**: Socket.IO for live notifications and updates
- **Authentication**: JWT tokens with 7-day expiry
- **Payments**: GCash integration with payment intents
- **Monitoring**: Custom health checks and performance tracking
- **UI**: Modern, accessible design with custom theme system

---

## 🛠️ Quick Troubleshooting

### ❌ "Command not found" (Mac/Linux)
```bash
# Make setup script executable
chmod +x setup.sh
./setup.sh
```

### ❌ "Port already in use"
```bash
# Change backend port in backend/.env
PORT=5001

# Change frontend port
cd frontend
npm run dev -- -p 3001
```

### ❌ "MongoDB connection failed"
- Download [MongoDB Compass](https://mongodb.com/products/tools/compass)
- Click "Connect" to start local database
- Or use cloud: [MongoDB Atlas](https://mongodb.com/atlas)

### ❌ Need Help?
- Check the detailed [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- Visit http://localhost:5000/api/health for system status

---

## 🎯 Next Steps

1. **Test Advanced Booking** → Try the custom date/time picker with AM/PM selection
2. **Explore Real-time Features** → Open multiple tabs to see live notifications
3. **Test Payment System** → Use GCash simulator for booking payments
4. **Check Admin Dashboard** → Monitor live booking updates and analytics
5. **Configure Notifications** → Set up email/SMS for booking confirmations
6. **Explore Recommendations** → See AI-powered service suggestions
7. **Test Queue System** → Try booking unavailable items to see smart queuing
8. **Monitor System Health** → Check http://localhost:5000/api/health
9. **Customize Services** → Add your own offerings with inventory management
10. **Deploy to Production** → Use the deployment guides for live deployment

---

**🎉 Happy booking!** Your TrixTech system is ready to use! 🚀

## Folder Structure

\`\`\`
TRIXTECH/
├── backend/          # Express.js API server
│   ├── config/       # Database configuration
│   ├── models/       # MongoDB schemas
│   ├── routes/       # API endpoints
│   ├── middleware/   # Auth & error handling
│   ├── utils/        # Email & analytics services
│   └── server.js     # Main server file
│
├── frontend/         # Next.js React app
│   ├── app/
│   │   ├── admin/    # Admin dashboard
│   │   ├── customer/ # Customer pages
│   │   ├── login/    # Authentication
│   │   └── page.tsx  # Home page
│   └── globals.css   # Tailwind styles
│
├── setup.sh         # Linux/Mac setup script
└── setup.bat        # Windows setup script
\`\`\`

## Troubleshooting

### Port Already in Use
\`\`\`bash
# Backend: Update backend/.env PORT variable
# Frontend: Run with custom port
cd frontend
npm run dev -- -p 3001
\`\`\`

### MongoDB Connection Error
- Ensure MongoDB is running
- Check MONGODB_URI in backend/.env
- Default: \`mongodb://localhost:27017/trixtech\`

### Module Not Found
\`\`\`bash
# Delete and reinstall
rm -rf node_modules package-lock.json
npm install
\`\`\`

### Email Not Working
Email is optional. To enable:
1. Get App Password from Gmail
2. Update EMAIL_USER and EMAIL_PASSWORD in backend/.env
3. Restart backend server

## Next Steps

1. **Customize Services** - Go to Admin Dashboard → Manage Services with inventory tracking
2. **Add More Admins** - Use Register page with role-based access control
3. **Configure Payments** - GCash integration is ready, add production credentials
4. **Monitor Analytics** - Real-time dashboard with automated metrics collection
5. **Test Notifications** - Configure email/SMS templates for booking confirmations
6. **Explore Recommendations** - AI-powered suggestions based on user behavior
7. **Deploy to Production** - Use Vercel for frontend, Render/Railway for backend with monitoring

## Support & Customization

For issues or customization needs, check the detailed SETUP_GUIDE.md file.
