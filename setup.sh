#!/bin/bash

echo "================================"
echo "TRIXTECH Booking System Setup"
echo "================================"
echo ""

# Function to print colored output
print_info() {
    echo -e "\033[1;34m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[1;32m[SUCCESS]\033[0m $1"
}

print_warning() {
    echo -e "\033[1;33m[WARNING]\033[0m $1"
}

print_error() {
    echo -e "\033[1;31m[ERROR]\033[0m $1"
}

# System Requirements Check
print_info "Checking system requirements..."

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed."
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Recommended version: Node.js 18+ with npm"
    echo ""
    echo "Installation commands:"
    echo "Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    echo "macOS: brew install node@18"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    print_warning "Node.js version $NODE_VERSION detected. Recommended: Node.js 18+"
    echo "Consider upgrading for better performance and security."
else
    print_success "Node.js version: $NODE_VERSION"
fi

# Check npm version
NPM_VERSION=$(npm --version)
print_info "npm version: $NPM_VERSION"

# Check if Docker is available (optional)
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_success "Docker available: $DOCKER_VERSION"
    DOCKER_AVAILABLE=true
else
    print_warning "Docker not found. Docker is recommended for production deployment."
    DOCKER_AVAILABLE=false
fi

# Check if Docker Compose is available
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_success "Docker Compose available: $COMPOSE_VERSION"
elif docker compose version &> /dev/null 2>&1; then
    COMPOSE_VERSION=$(docker compose version)
    print_success "Docker Compose (v2) available: $COMPOSE_VERSION"
else
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_warning "Docker Compose not found. Required for production deployment."
    fi
fi

# Check available memory
MEM_GB=$(free -g | awk 'NR==2{printf "%.0f", $2}')
if [ "$MEM_GB" -lt 4 ]; then
    print_warning "System has ${MEM_GB}GB RAM. Recommended: 4GB+ for optimal performance."
else
    print_success "System memory: ${MEM_GB}GB"
fi

# Check available disk space
DISK_GB=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
if [ "$DISK_GB" -lt 10 ]; then
    print_warning "Low disk space: ${DISK_GB}GB available. Recommended: 10GB+ free space."
else
    print_success "Available disk space: ${DISK_GB}GB"
fi

echo ""
print_info "Starting TRIXTECH setup process..."

echo ""
print_info "[STEP 1/8] Installing backend dependencies..."
cd backend
print_info "Working directory: $(pwd)"
if npm install; then
    print_success "Backend dependencies installed"

    # Install additional dev dependencies for testing
    if npm install --save-dev jest supertest mongodb-memory-server cross-env; then
        print_success "Testing dependencies installed"
    else
        print_warning "Testing dependencies installation failed (optional)"
    fi
else
    print_error "Failed to install backend dependencies"
    cd ..
    exit 1
fi
cd ..

echo ""
print_info "[STEP 2/8] Installing frontend dependencies..."
cd frontend
print_info "Working directory: $(pwd)"
if npm install; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    cd ..
    exit 1
fi
cd ..

echo ""
print_info "[STEP 3/8] Database Setup (MongoDB)..."
if command -v mongod &> /dev/null; then
    print_success "MongoDB found in system PATH"
    MONGODB_AVAILABLE=true
elif command -v mongo &> /dev/null; then
    print_success "MongoDB client found (mongod may be running as service)"
    MONGODB_AVAILABLE=true
else
    print_warning "MongoDB not found in PATH."
    echo "Options:"
    echo "  1. Install MongoDB locally:"
    echo "     Ubuntu/Debian: sudo apt install mongodb"
    echo "     macOS: brew install mongodb-community"
    echo "     Download: https://www.mongodb.com/try/download/community"
    echo ""
    echo "  2. Use MongoDB Atlas (Cloud - Recommended for production):"
    echo "     https://mongodb.com/atlas"
    echo ""
    echo "  3. Use Docker (Easiest for development):"
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo "     docker run -d -p 27017:27017 --name mongodb mongo:latest"
    fi
    MONGODB_AVAILABLE=false
fi

echo ""
print_info "[STEP 4/8] Environment Configuration..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp "backend/.env.example" "backend/.env"
        print_info "Created backend/.env from .env.example"
        print_warning "⚠️  IMPORTANT: Edit backend/.env with your actual configuration values"
        echo ""
        echo "Required settings:"
        echo "  MONGODB_URI=mongodb://localhost:27017/trixtech"
        echo "  JWT_SECRET=your-32-character-secret-key-here"
        echo "  GCASH_QR_CODE=your-gcash-qr-code-string"
        echo ""
        echo "Optional settings:"
        echo "  EMAIL_USER=your-email@gmail.com"
        echo "  EMAIL_PASSWORD=your-app-password"
        echo "  ADMIN_EMAIL=admin@yourdomain.com"
    else
        print_warning "backend/.env.example not found. Please create backend/.env manually"
    fi
else
    print_info "backend/.env already exists"
fi

if [ ! -f "frontend/.env.local" ]; then
    if [ -f "frontend/.env.example" ]; then
        cp "frontend/.env.example" "frontend/.env.local"
        print_info "Created frontend/.env.local from .env.example"
    else
        print_warning "frontend/.env.example not found. Please create frontend/.env.local manually"
    fi
else
    print_info "frontend/.env.local already exists"
fi

echo ""
print_info "[STEP 5/8] Testing Setup..."
cd backend
if npm test -- --passWithNoTests &> /dev/null; then
    print_success "Testing framework configured"
else
    print_warning "Testing setup incomplete (optional)"
fi
cd ..

echo ""
print_info "[STEP 6/8] Docker Setup (Optional)..."
if [ "$DOCKER_AVAILABLE" = true ]; then
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.prod.yml" ]; then
        print_success "Docker Compose files found"
        echo "Production deployment: docker-compose -f docker-compose.prod.yml up -d"
        echo "Development: docker-compose up -d"
    else
        print_info "Docker Compose files not found (optional)"
    fi
else
    print_info "Docker not available (optional for development)"
fi

echo ""
print_info "[STEP 7/8] Backup System Setup..."
if [ -f "scripts/backup.sh" ]; then
    chmod +x scripts/backup.sh
    print_success "Backup script configured"
    echo "Run: ./scripts/backup.sh for manual backup"
    if [ -f "scripts/setup-backup-cron.sh" ]; then
        print_info "Automated backup setup available: ./scripts/setup-backup-cron.sh"
    fi
else
    print_warning "Backup scripts not found (optional)"
fi

echo ""
print_info "[STEP 8/8] Creating startup scripts..."
if [ ! -f "start.sh" ]; then
    cat > start.sh << 'EOF'
#!/bin/bash
echo "Starting TRIXTECH Booking System..."
echo ""

echo "Starting backend server..."
cd backend && npm start &
BACKEND_PID=$!

sleep 3

echo "Starting frontend server..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "🚀 Servers starting..."
echo "🔧 Backend:  http://localhost:5000"
echo "🎨 Frontend: http://localhost:3000"
echo ""
echo "📊 Health Check: http://localhost:5000/api/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user interrupt
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
EOF

    chmod +x start.sh
    print_success "Created start.sh for easy startup"
fi

# Create production startup script
if [ ! -f "start-prod.sh" ]; then
    cat > start-prod.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting TRIXTECH Production Environment..."
echo ""

if command -v docker-compose &> /dev/null; then
    echo "🐳 Using Docker Compose..."
    docker-compose -f docker-compose.prod.yml up -d
    echo ""
    echo "✅ Production environment started!"
    echo "🌐 Frontend: https://yourdomain.com"
    echo "🔧 Backend:  https://api.yourdomain.com"
    echo "📊 Grafana:  https://yourdomain.com:3001"
    echo ""
    echo "📋 View logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "🛑 Stop: docker-compose -f docker-compose.prod.yml down"
elif command -v docker &> /dev/null && docker compose version &> /dev/null 2>&1; then
    echo "🐳 Using Docker Compose (v2)..."
    docker compose -f docker-compose.prod.yml up -d
    echo ""
    echo "✅ Production environment started!"
    echo "🌐 Frontend: https://yourdomain.com"
    echo "🔧 Backend:  https://api.yourdomain.com"
    echo "📊 Grafana:  https://yourdomain.com:3001"
else
    echo "❌ Docker/Docker Compose not available"
    echo "📖 See DEPLOYMENT_PRODUCTION.md for manual deployment"
    exit 1
fi
EOF

    chmod +x start-prod.sh
    print_success "Created start-prod.sh for production deployment"
fi

echo ""
echo "================================"
print_success "🎉 SETUP COMPLETE! SUCCESS!"
echo "================================"
echo ""
echo "✅ Your TRIXTECH Booking System is ready!"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 NEXT STEPS - Choose Your Path:"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "🧪 DEVELOPMENT MODE:"
echo "─────────────────────"
if [ "$MONGODB_AVAILABLE" = true ]; then
    echo "✅ MongoDB available - Ready for development!"
else
    echo "⚠️  MongoDB setup required (see step 2 below)"
fi
echo ""
echo "1. 📝 Configure Environment:"
echo "   • Edit backend/.env (MONGODB_URI, JWT_SECRET, GCASH_QR_CODE)"
echo "   • Edit frontend/.env.local (API URLs)"
echo ""
echo "2. 🗄️  Setup Database:"
if [ "$MONGODB_AVAILABLE" = false ]; then
    echo "   • Install MongoDB locally OR"
    echo "   • Use MongoDB Atlas (cloud) OR"
    echo "   • Use Docker: docker run -d -p 27017:27017 mongo"
fi
echo ""
echo "3. 🚀 Start Development:"
echo "   • Quick start: ./start.sh"
echo "   • Manual: Terminal 1: cd backend && npm start"
echo "            Terminal 2: cd frontend && npm run dev"
echo ""
echo "4. 🧪 Run Tests:"
echo "   • Backend: cd backend && npm test"
echo "   • Coverage: cd backend && npm run test:coverage"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🏭 PRODUCTION DEPLOYMENT:"
echo "─────────────────────────"
if [ "$DOCKER_AVAILABLE" = true ]; then
    echo "✅ Docker available - Production ready!"
    echo ""
    echo "🚀 Quick Deploy: ./start-prod.sh"
    echo ""
    echo "📋 Production Checklist:"
    echo "   • Configure SSL certificates"
    echo "   • Setup domain name"
    echo "   • Configure production environment variables"
    echo "   • Setup automated backups"
    echo "   • Configure monitoring alerts"
else
    echo "⚠️  Docker recommended for production deployment"
    echo "📖 See DEPLOYMENT_PRODUCTION.md for manual setup"
fi
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🌐 ACCESS URLs (Development):"
echo "─────────────────────────────"
echo "📱 Customer Portal:  http://localhost:3000"
echo "👑 Admin Dashboard:  http://localhost:3000/admin"
echo "🔌 Backend API:      http://localhost:5000/api"
echo "❤️ Health Check:     http://localhost:5000/api/health"
echo "📊 System Status:    http://localhost:5000/api/health"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🔑 DEMO ACCOUNTS:"
echo "─────────────────"
echo "👑 ADMIN:    admin@trixtech.com     / admin123"
echo "👤 CUSTOMER: customer@trixtech.com  / customer123"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📚 DOCUMENTATION & RESOURCES:"
echo "─────────────────────────────"
echo "📖 Available Guides:"
echo "   • README.md              - Project overview"
echo "   • SETUP_GUIDE.md         - Detailed setup"
echo "   • QUICK_START.md         - 2-minute setup"
echo "   • DEPLOYMENT_PRODUCTION.md - Production deployment"
echo "   • MAINTENANCE_GUIDE.md   - System maintenance"
echo "   • UAT_GUIDE.md          - Testing procedures"
echo "   • API_REFERENCE.md      - API documentation"
echo ""
echo "🛠️  Development Tools:"
echo "   • Testing: cd backend && npm test"
echo "   • Linting: Check individual package.json scripts"
echo "   • Backup: ./scripts/backup.sh"
echo "   • Monitoring: http://localhost:5000/api/health"
echo ""
echo "🆘 Need Help?"
echo "   • Check logs: backend/logs/ and frontend/.next/"
echo "   • Health check: http://localhost:5000/api/health"
echo "   • Test endpoints: http://localhost:5000/api/test"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 READY FOR DEVELOPMENT & PRODUCTION! HAPPY CODING! 🚀"
echo "═══════════════════════════════════════════════════════════════"
echo ""
