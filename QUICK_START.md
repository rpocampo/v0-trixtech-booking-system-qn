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
- ✅ **User Management** - Registration, login, profiles
- ✅ **Service Booking** - Browse, book, manage reservations
- ✅ **Inventory Control** - Track equipment availability
- ✅ **Admin Dashboard** - Manage services, view analytics
- ✅ **Real-time Updates** - Live notifications and status
- ✅ **Email Notifications** - Booking confirmations (optional)
- ✅ **Mobile Responsive** - Works on all devices

### 🏗️ Technical Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB
- **Real-time**: Socket.IO for live updates
- **Authentication**: JWT tokens
- **UI**: Modern, accessible design

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

1. **Explore Admin Panel** → Add services, manage inventory
2. **Test Customer Flow** → Register, browse, book services
3. **Customize Services** → Add your own offerings
4. **Configure Email** → Enable booking notifications
5. **Deploy to Production** → Use the deployment guides

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

1. **Customize Services** - Go to Admin Dashboard → Manage Services
2. **Add More Admins** - Use Register page with same flow
3. **Collect Payments** - Integrate Stripe in booking routes
4. **Monitor Analytics** - Check analytics endpoint for business metrics
5. **Deploy to Production** - Use Vercel for frontend, Render/Railway for backend

## Support & Customization

For issues or customization needs, check the detailed SETUP_GUIDE.md file.
