@echo off
echo ================================
echo TRIXTECH Booking System Setup
echo ================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Error: Node.js is not installed. Please install Node.js first.
    exit /b 1
)

echo Installing backend dependencies...
cd backend
call npm install
cd ..

echo.
echo Installing frontend dependencies...
cd frontend
call npm install
cd ..

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Copy .env.example to .env in the backend folder and configure
echo 2. Start MongoDB on your system
echo 3. Run 'npm run dev' from the backend folder in one terminal
echo 4. Run 'npm run dev' from the frontend folder in another terminal
echo.
echo Backend will run on http://localhost:5000
echo Frontend will run on http://localhost:3000
