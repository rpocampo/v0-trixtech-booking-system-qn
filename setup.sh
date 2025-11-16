#!/bin/bash

echo "================================"
echo "TRIXTECH Booking System Setup"
echo "================================"
echo ""

# Check if Node.js and npm are installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "Installing backend dependencies..."
cd backend
npm install
cd ..

echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy .env.example to .env in the backend folder and configure"
echo "2. Start MongoDB on your system"
echo "3. Run 'npm run dev' from the backend folder in one terminal"
echo "4. Run 'npm run dev' from the frontend folder in another terminal"
echo ""
echo "Backend will run on http://localhost:5000"
echo "Frontend will run on http://localhost:3000"
