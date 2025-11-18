@echo off
echo ================================
echo TRIXTECH Booking System Setup
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install Node.js from: https://nodejs.org/
    echo Recommended version: Node.js 18+ with npm
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [INFO] Node.js version: %NODE_VERSION%

REM Check npm version
for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo [INFO] npm version: %NPM_VERSION%

echo.
echo [STEP 1/6] Installing backend dependencies...
cd backend
echo [INFO] Working directory: %cd%
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] Backend dependencies installed

echo.
echo [STEP 2/6] Installing frontend dependencies...
cd frontend
echo [INFO] Working directory: %cd%
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    cd ..
    pause
    exit /b 1
)
cd ..
echo [SUCCESS] Frontend dependencies installed

echo.
echo [STEP 3/6] Checking for MongoDB...
where mongod >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] MongoDB not found in PATH.
    echo Please ensure MongoDB is installed and running.
    echo Download from: https://www.mongodb.com/try/download/community
) else (
    echo [SUCCESS] MongoDB found in system PATH
)

echo.
echo [STEP 4/6] Setting up environment configuration...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env"
        echo [INFO] Created backend/.env from .env.example
        echo [WARNING] Please edit backend/.env with your actual configuration values
    ) else (
        echo [WARNING] backend/.env.example not found. Please create backend/.env manually
    )
) else (
    echo [INFO] backend/.env already exists
)

echo.
echo [STEP 5/6] Verifying installation...
cd backend
call npm list --depth=0 >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Backend dependency verification failed
) else (
    echo [SUCCESS] Backend dependencies verified
)
cd ..

cd frontend
call npm list --depth=0 >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Frontend dependency verification failed
) else (
    echo [SUCCESS] Frontend dependencies verified
)
cd ..

echo.
echo [STEP 6/6] Creating startup scripts...
if not exist "start.bat" (
    echo @echo off > start.bat
    echo echo Starting TRIXTECH Booking System... >> start.bat
    echo echo. >> start.bat
    echo echo Starting backend server... >> start.bat
    echo start cmd /k "cd backend && npm start" >> start.bat
    echo timeout /t 3 /nobreak >nul >> start.bat
    echo echo Starting frontend server... >> start.bat
    echo start cmd /k "cd frontend && npm run dev" >> start.bat
    echo echo. >> start.bat
    echo echo Servers starting... >> start.bat
    echo echo Backend: http://localhost:5000 >> start.bat
    echo echo Frontend: http://localhost:3000 >> start.bat
    echo pause >> start.bat
    echo [SUCCESS] Created start.bat for easy startup
)

echo.
echo ================================
echo SETUP COMPLETE! ✅
echo ================================
echo.
echo Your TRIXTECH Booking System is ready to run!
echo.
echo IMPORTANT NEXT STEPS:
echo ─────────────────────
echo 1. 📝 Configure Environment Variables:
echo    - Edit backend/.env with your settings
echo    - Required: MONGODB_URI, JWT_SECRET, EMAIL credentials
echo.
echo 2. 🗄️  Start MongoDB:
echo    - Make sure MongoDB is running on your system
echo    - Default connection: mongodb://localhost:27017/trixtech
echo.
echo 3. 🚀 Start the Application:
echo    - Option A: Run 'start.bat' (opens both servers)
echo    - Option B: Manual startup:
echo      Terminal 1: cd backend && npm start
echo      Terminal 2: cd frontend && npm run dev
echo.
echo 🌐 Access URLs:
echo    - Frontend: http://localhost:3000
echo    - Backend API: http://localhost:5000
echo    - Admin Dashboard: http://localhost:3000/admin/dashboard
echo.
echo 📚 Documentation:
echo    - README.md - Project overview
echo    - SETUP_GUIDE.md - Detailed setup instructions
echo    - API_REFERENCE.md - API documentation
echo.
echo 🎯 Ready to start developing! Happy coding! 🚀
echo.
pause
