# ⚡ TRIXTECH - Quick Start Guide (1 Minute!)

## 🚀 One-Command Installation & Start

**Works on Windows, Mac, and Linux:**

```bash
# Install everything and start the system
npm run quickstart

# OR step by step:
npm install      # Install all dependencies
npm run dev     # Start both servers
```

**That's it!** 🎉 Your booking system will be running in under 1 minute!

The system automatically:
- ✅ Installs backend + frontend dependencies
- ✅ Sets up environment configuration
- ✅ Starts MongoDB (if available)
- ✅ Seeds demo data
- ✅ Launches both servers together

---

## 📱 Access Your Application

- 🌐 **Customer Portal**: http://localhost:3000
- 👑 **Admin Dashboard**: http://localhost:3000/admin
- 🔌 **Backend API**: http://localhost:5000/api
- ❤️ **Health Check**: http://localhost:5000/api/health

---

## 🔑 Demo Accounts

**👑 Admin Access:**
- Email: `admin@trixtech.com`
- Password: `admin123`

**👤 Customer Access:**
- Email: `customer@trixtech.com`
- Password: `customer123`

---

## 🛑 Stop the System

```bash
# Press Ctrl+C in the terminal
# OR on Windows: taskkill /f /im node.exe
```

---

## 🛠️ Alternative Commands

```bash
# Install only dependencies
npm run install:all

# Start only backend
npm run dev:backend

# Start only frontend
npm run dev:frontend

# Run tests
npm test

# Build for production
npm run build
```

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

### 🎯 Core Features (50+ Advanced Capabilities)
- ✅ **User Management** - Registration, login, OTP verification, profiles
- ✅ **Service Booking** - Browse, book, manage reservations with packages
- ✅ **Advanced Inventory** - Track equipment, batch management, auto-alerts
- ✅ **Admin Dashboard** - Manage services, analytics, delivery tracking
- ✅ **Real-time Updates** - Live notifications, WebSocket sync
- ✅ **AI Recommendations** - Smart suggestions, personalization
- ✅ **Delivery Management** - Scheduled delivery coordination
- ✅ **Automated Processes** - Auto-rebooking, discounts, invoice generation
- ✅ **Business Intelligence** - Advanced analytics and reporting
- ✅ **Mobile Responsive** - Works on all devices

### 🏗️ Technical Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, MongoDB, Redis
- **Real-time**: Socket.IO for live updates
- **Authentication**: JWT tokens with OTP verification
- **AI Features**: Smart recommendations and personalization
- **UI**: Modern, accessible design with 50+ advanced features

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
