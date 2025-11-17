# TRIXTECH - Quick Start Guide

## One-Command Installation

Choose your operating system:

### Windows
\`\`\`bash
setup.bat
\`\`\`

### Mac/Linux
\`\`\`bash
chmod +x setup.sh
./setup.sh
\`\`\`

This automatically installs all dependencies for both frontend and backend.

## 2-Minute Setup

### Step 1: Copy Environment Files
\`\`\`bash
# Backend
cd backend
cp .env.example .env
cd ..

# Frontend  
cd frontend
cp .env.example .env.local
cd ..
\`\`\`

### Step 2: Start MongoDB
Choose your system:

**Mac (Homebrew):**
\`\`\`bash
brew services start mongodb-community
\`\`\`

**Windows (MongoDB Compass):**
- Download and install MongoDB Compass
- Click "Connect" button to start local MongoDB

**Linux:**
\`\`\`bash
sudo systemctl start mongod
\`\`\`

### Step 3: Start Both Servers

**Terminal 1 - Backend:**
\`\`\`bash
cd backend
npm run dev
\`\`\`

**Terminal 2 - Frontend:**
\`\`\`bash
cd frontend
npm run dev
\`\`\`

### Step 4: Access the App
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api


## Key Features

✓ User authentication (Admin & Customer roles)
✓ Service management and booking
✓ Double-booking prevention
✓ Email notifications (optional)
✓ Analytics and reporting
✓ Responsive modern UI
✓ Real-time data updates

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
