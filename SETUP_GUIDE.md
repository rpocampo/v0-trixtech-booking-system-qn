# TRIXTECH Booking System - Setup Guide

## Quick Start (One Command)

### On Windows:
\`\`\`bash
setup.bat
\`\`\`

### On Mac/Linux:
\`\`\`bash
chmod +x setup.sh
./setup.sh
\`\`\`

This will automatically install all dependencies for both frontend and backend.

## Manual Setup (If scripts don't work)

### Step 1: Install Dependencies
\`\`\`bash
# Install backend dependencies
cd backend
npm install
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
\`\`\`

### Step 2: Configure Environment Variables

**Backend Configuration:**
1. Go to the `backend` folder
2. Copy `.env.example` to `.env`
3. Update the following values:

\`\`\`env
MONGODB_URI=mongodb://localhost:27017/trixtech
JWT_SECRET=your_secure_secret_key_here
EMAIL_USER=your_email@gmail.com  # Optional
EMAIL_PASSWORD=your_app_password  # Optional
\`\`\`

**Frontend Configuration:**
1. Go to the `frontend` folder
2. Copy `.env.example` to `.env.local`
3. Ensure API_URL points to your backend

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
\`\`\`

### Step 3: Start MongoDB

**On Mac (using Homebrew):**
\`\`\`bash
brew services start mongodb-community
\`\`\`

**On Windows (using MongoDB Compass):**
- Download MongoDB Compass from https://www.mongodb.com/products/tools/compass
- Click "Connect" to start a local MongoDB instance

**On Linux:**
\`\`\`bash
sudo systemctl start mongod
\`\`\`

### Step 4: Start the Application

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

## Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health


## Troubleshooting

### MongoDB Connection Error
- Ensure MongoDB is running on your system
- Check MONGODB_URI in backend/.env is correct
- Default: `mongodb://localhost:27017/trixtech`

### Port Already in Use
- Backend: Change PORT in backend/.env (default: 5000)
- Frontend: Run `npm run dev -- -p 3001` in frontend folder

### Module Not Found Error
- Delete `node_modules` folder and `package-lock.json`
- Run `npm install` again in that folder

### Email Notifications Not Working
- Email is optional. Leave EMAIL_* variables blank to skip
- To enable: Get an App Password from your Gmail account
- Update EMAIL_USER and EMAIL_PASSWORD in .env

## Production Deployment

When deploying to production:
1. Change JWT_SECRET to a secure random string
2. Update FRONTEND_URL and NEXT_PUBLIC_API_URL to production URLs
3. Set NODE_ENV=production
4. Use a managed MongoDB service (MongoDB Atlas, etc.)
5. Update email configuration if using notifications

## Support

For issues, check the logs in both terminals for error messages.
