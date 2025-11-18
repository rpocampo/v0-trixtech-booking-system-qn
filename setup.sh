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

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed."
    echo "Please install Node.js from: https://nodejs.org/"
    echo "Recommended version: Node.js 18+ with npm"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
print_info "Node.js version: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
print_info "npm version: $NPM_VERSION"

echo ""
print_info "Starting TRIXTECH setup process..."

echo ""
print_info "[STEP 1/6] Installing backend dependencies..."
cd backend
print_info "Working directory: $(pwd)"
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    cd ..
    exit 1
fi
cd ..

echo ""
print_info "[STEP 2/6] Installing frontend dependencies..."
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
print_info "[STEP 3/6] Checking for MongoDB..."
if command -v mongod &> /dev/null; then
    print_success "MongoDB found in system PATH"
elif command -v mongo &> /dev/null; then
    print_success "MongoDB client found (mongod may be running as service)"
else
    print_warning "MongoDB not found in PATH."
    echo "Please ensure MongoDB is installed and running."
    echo "Installation guides:"
    echo "  - Ubuntu/Debian: sudo apt install mongodb"
    echo "  - macOS: brew install mongodb-community"
    echo "  - Download: https://www.mongodb.com/try/download/community"
fi

echo ""
print_info "[STEP 4/6] Setting up environment configuration..."
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp "backend/.env.example" "backend/.env"
        print_info "Created backend/.env from .env.example"
        print_warning "Please edit backend/.env with your actual configuration values"
    else
        print_warning "backend/.env.example not found. Please create backend/.env manually"
    fi
else
    print_info "backend/.env already exists"
fi

echo ""
print_info "[STEP 5/6] Verifying installation..."
cd backend
if npm list --depth=0 &> /dev/null; then
    print_success "Backend dependencies verified"
else
    print_warning "Backend dependency verification failed"
fi
cd ..

cd frontend
if npm list --depth=0 &> /dev/null; then
    print_success "Frontend dependencies verified"
else
    print_warning "Frontend dependency verification failed"
fi
cd ..

echo ""
print_info "[STEP 6/6] Creating startup scripts..."
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
echo "Servers starting..."
echo "Backend: http://localhost:5000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user interrupt
trap "echo 'Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
EOF

    chmod +x start.sh
    print_success "Created start.sh for easy startup"
fi

echo ""
echo "================================"
print_success "SETUP COMPLETE! ✅"
echo "================================"
echo ""
echo "Your TRIXTECH Booking System is ready to run!"
echo ""
echo "IMPORTANT NEXT STEPS:"
echo "─────────────────────"
echo "1. 📝 Configure Environment Variables:"
echo "   - Edit backend/.env with your settings"
echo "   - Required: MONGODB_URI, JWT_SECRET, EMAIL credentials"
echo ""
echo "2. 🗄️  Start MongoDB:"
echo "   - Make sure MongoDB is running on your system"
echo "   - Default connection: mongodb://localhost:27017/trixtech"
echo ""
echo "3. 🚀 Start the Application:"
echo "   - Option A: Run './start.sh' (starts both servers)"
echo "   - Option B: Manual startup:"
echo "     Terminal 1: cd backend && npm start"
echo "     Terminal 2: cd frontend && npm run dev"
echo ""
echo "🌐 Access URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:5000"
echo "   - Admin Dashboard: http://localhost:3000/admin/dashboard"
echo ""
echo "📚 Documentation:"
echo "   - README.md - Project overview"
echo "   - SETUP_GUIDE.md - Detailed setup instructions"
echo "   - API_REFERENCE.md - API documentation"
echo ""
echo "🎯 Ready to start developing! Happy coding! 🚀"
echo ""
