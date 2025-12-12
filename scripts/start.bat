@echo off
chcp 65001 >nul 2>&1
color 0A
cls
echo.
echo   ╔══════════════════════════════════════════════════════════════╗
echo   ║                 🚀 TRIXTECH BOOKING SYSTEM                   ║
echo   ║                      Application Startup                      ║
echo   ╚══════════════════════════════════════════════════════════════╝
echo.
echo   Starting servers... Please wait...
echo.
echo   🔧 Backend + Frontend Servers (Unified)
npm run dev
echo.
echo   ════════════════════════════════════════════════════════════════
echo   🌐 ACCESS URLs:
echo   ──────────────
echo   📱 Customer Portal: http://localhost:3000
echo   👑 Admin Dashboard: http://localhost:3000/admin
echo   🔌 Backend API:     http://localhost:5000/api
echo   ❤️ Health Check:    http://localhost:5000/api/health
echo.
echo   ════════════════════════════════════════════════════════════════
echo   📚 DEMO ACCOUNTS:
echo   ─────────────────
echo   👑 Admin: admin@trixtech.com / admin123
echo   👤 Customer: customer@trixtech.com / customer123
echo.
echo   Press any key to close this window...
pause >nul
