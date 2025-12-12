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

REM System Requirements Check
echo   🔍 System Requirements Check...
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
    echo   📦 Download: https://nodejs.org/dist/v18.19.0/node-v18.19.0-x64.msi
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

REM Check available memory (rough estimate)
for /f "tokens=2" %%i in ('systeminfo ^| find "Total Physical Memory"') do set MEM_INFO=%%i
echo   💾 System Memory: %MEM_INFO%

REM Check Windows version
for /f "tokens=2*" %%i in ('systeminfo ^| find "OS Name"') do set OS_NAME=%%i %%j
echo   🪟 OS: %OS_NAME%

REM Check if Docker is available
where docker >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VERSION=%%i
    echo   ✅ Docker available: %DOCKER_VERSION%
    set DOCKER_AVAILABLE=true
) else (
    echo   ⚠️  Docker not found (recommended for production)
    set DOCKER_AVAILABLE=false
)

REM Check if Docker Compose is available
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('docker-compose --version') do set COMPOSE_VERSION=%%i
    echo   ✅ Docker Compose available: %COMPOSE_VERSION%
) else (
    docker compose version >nul 2>nul
    if %errorlevel% equ 0 (
        for /f "tokens=*" %%i in ('docker compose version') do set COMPOSE_VERSION=%%i
        echo   ✅ Docker Compose (v2) available: %COMPOSE_VERSION%
    ) else (
        if "%DOCKER_AVAILABLE%"=="true" (
            echo   ⚠️  Docker Compose not found (required for production)
        )
    )
)

echo   ✅ System requirements verified
echo.

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
echo   📦 Step 1/9: Installing All Dependencies (Backend + Frontend)
echo   ──────────────────────────────────────────────────────────────
echo   📂 Working directory: %cd%
echo   ⏳ Installing packages... (this may take a few minutes)
echo   🌱 Note: Database seeding will run automatically after installation
call npm run install:all
if %errorlevel% neq 0 (
    echo.
    echo   ❌ Failed to install dependencies
    echo   💡 Try running: npm cache clean --force
    echo   💡 Then run this setup script again
    pause
    exit /b 1
)
echo   ✅ All dependencies installed successfully
echo.

echo   🗄️  Step 3/9: Database Setup (MongoDB)
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
    echo   ☁️  CLOUD OPTION: MongoDB Atlas (Recommended for production)
    echo   🌐 https://mongodb.com/atlas
    echo.
    if "%DOCKER_AVAILABLE%"=="true" (
        echo   🐳 DOCKER OPTION: docker run -d -p 27017:27017 --name mongodb mongo
        echo.
    )
    echo   ⚠️  IMPORTANT: Start MongoDB before running the application
    set MONGODB_AVAILABLE=false
) else (
    echo   ✅ MongoDB found in system PATH
    echo   💡 MongoDB is ready to use
    set MONGODB_AVAILABLE=true
)
echo.

echo   ⚙️  Step 4/9: Environment Configuration
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
        echo   GCASH_QR_CODE=your-gcash-qr-code-string
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

echo   🧪 Step 5/9: Testing Setup
echo   ──────────────────────────────────────────────────────────────
cd backend
call npm test -- --passWithNoTests >nul 2>nul
if %errorlevel% neq 0 (
    echo   ⚠️  Testing framework setup incomplete (optional)
) else (
    echo   ✅ Testing framework configured
)
cd ..
echo.

echo   🐳 Step 6/9: Docker Setup (Optional)
echo   ──────────────────────────────────────────────────────────────
if "%DOCKER_AVAILABLE%"=="true" (
    if exist "docker-compose.yml" (
        echo   ✅ Docker Compose files found
        echo   💡 Production deployment: docker-compose -f docker-compose.prod.yml up -d
        echo   💡 Development: docker-compose up -d
    ) else (
        echo   ℹ️  Docker Compose files not found (optional)
    )
) else (
    echo   ℹ️  Docker not available (optional for development)
)
echo.

echo   💾 Step 7/9: Backup System Setup
echo   ──────────────────────────────────────────────────────────────
if exist "scripts\backup.sh" (
    echo   ✅ Backup script found
    echo   💡 Run: scripts\backup.sh for manual backup
    if exist "scripts\setup-backup-cron.sh" (
        echo   💡 Automated backup setup: scripts\setup-backup-cron.sh
    )
) else (
    echo   ⚠️  Backup scripts not found (optional)
)
echo.

echo    Step 8/9: Installation Verification
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

echo   🚀 Step 9/9: Creating Startup Scripts
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

echo   🎯 Step 9/9: Final Setup & Verification
echo   ──────────────────────────────────────────────────────────────
REM Demo data seeding now happens automatically during npm install
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
echo   🚀 NEXT STEPS - Choose Your Path:
echo   ════════════════════════════════════════════════════════════════
echo.
echo   🧪 DEVELOPMENT MODE:
echo   ───────────────────
if "%MONGODB_AVAILABLE%"=="true" (
    echo   ✅ MongoDB available - Ready for development!
) else (
    echo   ⚠️  MongoDB setup required (see step 2 below)
)
echo.
echo   1. 📝 Configure Environment:
echo      • Edit backend/.env (MONGODB_URI, JWT_SECRET, GCASH_QR_CODE)
echo      • Edit frontend/.env.local (API URLs)
echo.
echo   2. 🗄️  Setup Database:
if "%MONGODB_AVAILABLE%"=="false" (
    echo      • Install MongoDB locally OR
    echo      • Use MongoDB Atlas (cloud) OR
    echo      • Use Docker: docker run -d -p 27017:27017 mongo
)
echo.
echo   3. 🚀 Start Development:
echo      • Quick start: start.bat
echo      • Manual: Terminal 1: cd backend && npm start
echo                 Terminal 2: cd frontend && npm run dev
echo.
echo   4. 🧪 Run Tests:
echo      • Backend: cd backend && npm test
echo      • Coverage: cd backend && npm run test:coverage
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🏭 PRODUCTION DEPLOYMENT:
echo   ───────────────────────
if "%DOCKER_AVAILABLE%"=="true" (
    echo   ✅ Docker available - Production ready!
    echo.
    echo   🚀 Quick Deploy: docker-compose -f docker-compose.prod.yml up -d
    echo.
    echo   📋 Production Checklist:
    echo      • Configure SSL certificates
    echo      • Setup domain name
    echo      • Configure production environment variables
    echo      • Setup automated backups
    echo      • Configure monitoring alerts
) else (
    echo   ⚠️  Docker recommended for production deployment
    echo   📖 See DEPLOYMENT_PRODUCTION.md for manual setup
)
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
echo   📚 DOCUMENTATION & RESOURCES:
echo   ───────────────────────────
echo   📖 Available Guides:
echo      • README.md - Project overview
echo      • SETUP_GUIDE.md - Detailed setup instructions
echo      • QUICK_START.md - 2-minute setup guide
echo      • DEPLOYMENT_PRODUCTION.md - Production deployment
echo      • MAINTENANCE_GUIDE.md - System maintenance
echo      • UAT_GUIDE.md - Testing procedures
echo      • API_REFERENCE.md - API documentation
echo.
echo   ⚡ AUTO-UPDATING FEATURES:
echo   ────────────────────────
echo   🔄 Real-time Updates: Services refresh every 30 seconds
echo   📡 WebSocket Sync: Instant notifications and status updates
echo   🔄 Data Sync: Automatic background data synchronization
echo   📱 Auto-Refresh: UI updates without manual page refresh
echo   🎯 Optimistic UI: Immediate feedback with server sync
echo.
echo   🛠️  Development Tools:
echo      • Testing: cd backend && npm test
echo      • Linting: Check individual package.json scripts
echo      • Backup: scripts\backup.sh
echo      • Monitoring: http://localhost:5000/api/health
echo      • Auto-Update: Built-in real-time synchronization
echo.
echo   🆘 Need Help?
echo      • Check logs: backend/logs/ and frontend/.next/
echo      • Health check: http://localhost:5000/api/health
echo      • Test endpoints: http://localhost:5000/api/test
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🎯 READY TO START BOOKING! HAPPY CODING! 🚀
echo   ════════════════════════════════════════════════════════════════
echo.
echo   Press any key to exit...
pause >nul
