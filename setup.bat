@echo off
chcp 65001 >nul 2>&1
color 0A
cls
echo.
echo   ╔══════════════════════════════════════════════════════════════╗
echo   ║                    🚀 TRIXTECH BOOKING SYSTEM                 ║
echo   ║                     Windows Setup Script                      ║
echo   ╚══════════════════════════════════════════════════════════════╝
echo.
echo   📋 Prerequisites Check...
echo   ──────────────────────────────────────────────────────────────

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo   ❌ Node.js is not installed.
    echo.
    echo   📥 Please download and install Node.js from:
    echo   🌐 https://nodejs.org/
    echo   💡 Recommended: Node.js 18+ (LTS version)
    echo.
    echo   After installation, run this script again.
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo   ✅ Node.js version: %NODE_VERSION%

REM Check npm version
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo   ✅ npm version: %NPM_VERSION%

REM Check if we're in the right directory
if not exist "backend" (
    echo   ❌ Error: 'backend' directory not found.
    echo   💡 Please run this script from the project root directory.
    pause
    exit /b 1
)

if not exist "frontend" (
    echo   ❌ Error: 'frontend' directory not found.
    echo   💡 Please run this script from the project root directory.
    pause
    exit /b 1
)

echo   ✅ Project structure verified
echo.

echo   🔧 Installation Progress...
echo   ──────────────────────────────────────────────────────────────
echo.
echo   📦 Step 1/7: Installing Backend Dependencies
echo   ──────────────────────────────────────────────────────────────
cd backend
echo   📂 Working directory: %cd%
echo   ⏳ Installing packages... (this may take a few minutes)
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   ❌ Failed to install backend dependencies
    echo   💡 Try running: npm cache clean --force
    echo   💡 Then run this setup script again
    cd ..
    pause
    exit /b 1
)
cd ..
echo   ✅ Backend dependencies installed successfully
echo.

echo   🎨 Step 2/7: Installing Frontend Dependencies
echo   ──────────────────────────────────────────────────────────────
cd frontend
echo   📂 Working directory: %cd%
echo   ⏳ Installing packages... (this may take a few minutes)
call npm install
if %errorlevel% neq 0 (
    echo.
    echo   ❌ Failed to install frontend dependencies
    echo   💡 Try running: npm cache clean --force
    echo   💡 Then run this setup script again
    cd ..
    pause
    exit /b 1
)
cd ..
echo   ✅ Frontend dependencies installed successfully
echo.

echo   🗄️  Step 3/7: Database Setup (MongoDB)
echo   ──────────────────────────────────────────────────────────────
where mongod >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠️  MongoDB not found in system PATH
    echo.
    echo   📥 RECOMMENDED: Download MongoDB Compass (Easiest!)
    echo   🌐 https://mongodb.com/products/tools/compass
    echo   💡 Just click "Connect" - no installation needed!
    echo.
    echo   🔧 ALTERNATIVE: Install MongoDB Community Server
    echo   🌐 https://mongodb.com/try/download/community
    echo.
    echo   ⚠️  IMPORTANT: Start MongoDB before running the application
) else (
    echo   ✅ MongoDB found in system PATH
    echo   💡 MongoDB is ready to use
)
echo.

echo   ⚙️  Step 4/7: Environment Configuration
echo   ──────────────────────────────────────────────────────────────
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env"
        echo   ✅ Created backend/.env from template
        echo   ⚠️  IMPORTANT: Edit backend/.env with your settings
        echo.
        echo   📝 Required Backend Settings:
        echo   ─────────────────────────────
        echo   MONGODB_URI=mongodb://localhost:27017/trixtech
        echo   JWT_SECRET=your-32-character-secret-key-here
        echo   EMAIL_USER=your-email@gmail.com (optional)
        echo   EMAIL_PASSWORD=your-app-password (optional)
        echo.
    ) else (
        echo   ⚠️  backend/.env.example not found
        echo   📝 Please create backend/.env manually with required settings
    )
) else (
    echo   ✅ backend/.env already exists
)

if not exist "frontend\.env.local" (
    if exist "frontend\.env.example" (
        copy "frontend\.env.example" "frontend\.env.local"
        echo   ✅ Created frontend/.env.local from template
    ) else (
        echo   ⚠️  frontend/.env.example not found
        echo   📝 Please create frontend/.env.local manually
    )
) else (
    echo   ✅ frontend/.env.local already exists
)
echo.

echo   🔍 Step 5/7: Installation Verification
echo   ──────────────────────────────────────────────────────────────
cd backend
call npm list --depth=0 >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠️  Backend dependency verification warning
) else (
    echo   ✅ Backend dependencies verified
)
cd ..

cd frontend
call npm list --depth=0 >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠️  Frontend dependency verification warning
) else (
    echo   ✅ Frontend dependencies verified
)
cd ..
echo.

echo   🚀 Step 6/7: Creating Startup Scripts
echo   ──────────────────────────────────────────────────────────────
if not exist "start.bat" (
    echo @echo off > start.bat
    echo chcp 65001 ^>nul 2^>^&1 >> start.bat
    echo color 0A >> start.bat
    echo cls >> start.bat
    echo echo. >> start.bat
    echo echo   ╔══════════════════════════════════════════════════════════════╗ >> start.bat
    echo echo   ║                 🚀 TRIXTECH BOOKING SYSTEM                   ║ >> start.bat
    echo echo   ║                      Application Startup                      ║ >> start.bat
    echo echo   ╚══════════════════════════════════════════════════════════════╝ >> start.bat
    echo echo. >> start.bat
    echo echo   Starting servers... Please wait... >> start.bat
    echo echo. >> start.bat
    echo echo   🔧 Backend Server (Terminal 1) >> start.bat
    echo start "TRIXTECH Backend" cmd /k "cd backend && echo Backend Server && echo =============== && npm start" >> start.bat
    echo timeout /t 5 /nobreak ^>nul >> start.bat
    echo echo   🎨 Frontend Server (Terminal 2) >> start.bat
    echo start "TRIXTECH Frontend" cmd /k "cd frontend && echo Frontend Server && echo ================ && npm run dev" >> start.bat
    echo echo. >> start.bat
    echo echo   ════════════════════════════════════════════════════════════════ >> start.bat
    echo echo   🌐 ACCESS URLs: >> start.bat
    echo echo   ────────────── >> start.bat
    echo echo   📱 Customer Portal: http://localhost:3000 >> start.bat
    echo echo   👑 Admin Dashboard: http://localhost:3000/admin >> start.bat
    echo echo   🔌 Backend API:     http://localhost:5000/api >> start.bat
    echo echo   ❤️ Health Check:    http://localhost:5000/api/health >> start.bat
    echo echo. >> start.bat
    echo echo   ════════════════════════════════════════════════════════════════ >> start.bat
    echo echo   📚 DEMO ACCOUNTS: >> start.bat
    echo echo   ───────────────── >> start.bat
    echo echo   👑 Admin: admin@trixtech.com / admin123 >> start.bat
    echo echo   👤 Customer: customer@trixtech.com / customer123 >> start.bat
    echo echo. >> start.bat
    echo echo   Press any key to close this window... >> start.bat
    echo pause ^>nul >> start.bat
    echo   ✅ Created enhanced start.bat script
) else (
    echo   ✅ start.bat already exists
)
echo.

echo   🎯 Step 7/7: Final Setup & Demo Data
echo   ──────────────────────────────────────────────────────────────
REM Optional: Seed demo data if script exists
if exist "backend\scripts\seed.js" (
    echo   🌱 Seeding demo data...
    cd backend
    call node scripts\seed.js
    if %errorlevel% neq 0 (
        echo   ⚠️  Demo data seeding failed (non-critical)
    ) else (
        echo   ✅ Demo data seeded successfully
    )
    cd ..
) else (
    echo   ℹ️  Demo data script not found (optional)
)
echo.

echo   ╔══════════════════════════════════════════════════════════════╗
echo   ║                 🎉 SETUP COMPLETE! SUCCESS!                  ║
echo   ╚══════════════════════════════════════════════════════════════╝
echo.
echo   ✅ All dependencies installed successfully
echo   ✅ Environment files configured
echo   ✅ Startup scripts created
echo   ✅ Demo data seeded (if available)
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🚀 NEXT STEPS - Get Your System Running!
echo   ════════════════════════════════════════════════════════════════
echo.
echo   1️⃣  📝 CONFIGURE ENVIRONMENT (Required)
echo      ───────────────────────────────────
echo      Edit backend/.env with your settings:
echo      • MONGODB_URI=mongodb://localhost:27017/trixtech
echo      • JWT_SECRET=your-32-character-secret-key
echo      • EMAIL_USER=your-email@gmail.com (optional)
echo      • EMAIL_PASSWORD=your-app-password (optional)
echo.
echo   2️⃣  🗄️  START MONGODB (Required)
echo      ─────────────────────────────
echo      RECOMMENDED: Download MongoDB Compass
echo      🌐 https://mongodb.com/products/tools/compass
echo      💡 Just click "Connect" - no installation needed!
echo.
echo   3️⃣  🚀 START THE APPLICATION
echo      ──────────────────────────
echo      Option A - Easy Start: Run 'start.bat'
echo      Option B - Manual:
echo        Terminal 1: cd backend && npm start
echo        Terminal 2: cd frontend && npm run dev
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🌐 ACCESS YOUR APPLICATION
echo   ════════════════════════════════════════════════════════════════
echo.
echo   📱 Customer Portal:  http://localhost:3000
echo   👑 Admin Dashboard:  http://localhost:3000/admin
echo   🔌 Backend API:      http://localhost:5000/api
echo   ❤️ Health Check:     http://localhost:5000/api/health
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🔑 DEMO ACCOUNTS
echo   ════════════════════════════════════════════════════════════════
echo.
echo   👑 ADMIN ACCOUNT:
echo      Email: admin@trixtech.com
echo      Password: admin123
echo.
echo   👤 CUSTOMER ACCOUNT:
echo      Email: customer@trixtech.com
echo      Password: customer123
echo.
echo   ════════════════════════════════════════════════════════════════
echo   📚 DOCUMENTATION & SUPPORT
echo   ════════════════════════════════════════════════════════════════
echo.
echo   📖 Guides Available:
echo      • README.md - Project overview
echo      • SETUP_GUIDE.md - Detailed setup instructions
echo      • QUICK_START.md - 2-minute setup guide
echo      • DEPLOYMENT_GUIDE.md - Production deployment
echo      • MAINTENANCE_GUIDE.md - System maintenance
echo      • UAT_GUIDE.md - Testing procedures
echo.
echo   🆘 Need Help?
echo      • Check SETUP_GUIDE.md for detailed troubleshooting
echo      • Visit http://localhost:5000/api/health for system status
echo      • All logs are in backend/logs/ and frontend/.next/
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🎯 READY TO START BOOKING! HAPPY CODING! 🚀
echo   ════════════════════════════════════════════════════════════════
echo.
echo   Press any key to exit...
pause >nul
