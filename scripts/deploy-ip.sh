#!/bin/bash

# TRIXTECH IP-Based Deployment Script
# This script deploys the application for IP-based access (before domain setup)
# Optimized for KVM1 resources (1 vCPU, 4GB RAM)

set -e

echo "🚀 Starting TRIXTECH IP-based deployment for Hostinger KVM1..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="trixtech-booking-system"
DOCKER_COMPOSE_FILE="docker-compose-ip.yml"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Check system requirements
print_status "Checking system requirements..."

# Check CPU cores
CPU_CORES=$(nproc)
if [ "$CPU_CORES" -lt 1 ]; then
    print_error "Insufficient CPU cores. KVM1 should have at least 1 core."
    exit 1
fi

# Check RAM
TOTAL_RAM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
if [ "$TOTAL_RAM" -lt 4000 ]; then
    print_warning "Available RAM: ${TOTAL_RAM}MB. KVM1 should have 4096MB RAM."
fi

# Check disk space
DISK_SPACE=$(df / | tail -1 | awk '{print $4}')
DISK_SPACE_GB=$((DISK_SPACE / 1024 / 1024))
if [ "$DISK_SPACE_GB" -lt 40 ]; then
    print_warning "Available disk space: ${DISK_SPACE_GB}GB. KVM1 should have 50GB."
fi

print_status "System check completed."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    print_warning "Please log out and log back in for Docker group changes to take effect."
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create necessary directories
print_status "Creating necessary directories..."
sudo mkdir -p /var/log/nginx
sudo mkdir -p nginx/ssl
sudo mkdir -p nginx/logs

# Set proper permissions
sudo chown -R $USER:$USER nginx/

# Copy environment files if they don't exist
if [ ! -f "backend/.env" ]; then
    print_status "Setting up backend environment..."
    cp backend/.env.production backend/.env
    print_warning "Please edit backend/.env with your production values (MongoDB URI, JWT secret, etc.)"
fi

if [ ! -f "frontend/.env.local" ]; then
    print_status "Setting up frontend environment..."
    cp frontend/.env.production frontend/.env.local
    print_warning "Please edit frontend/.env.local with your server IP address"
fi

# Get server IP for configuration
print_info "Detecting server IP address..."
SERVER_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || hostname -I | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    print_warning "Could not automatically detect server IP. Please manually configure environment variables."
    SERVER_IP="YOUR_SERVER_IP"
else
    print_info "Detected server IP: $SERVER_IP"
fi

# Update frontend environment with detected IP
if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
    print_status "Updating frontend configuration with server IP..."
    sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$SERVER_IP|" frontend/.env.local
    sed -i "s|NEXT_PUBLIC_SOCKET_URL=.*|NEXT_PUBLIC_SOCKET_URL=http://$SERVER_IP|" frontend/.env.local
    sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://$SERVER_IP|" frontend/.env.local

    # Update backend environment
    sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://$SERVER_IP|" backend/.env
fi

# Build and deploy
print_status "Building Docker images..."
docker-compose -f $DOCKER_COMPOSE_FILE build

print_status "Starting services..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# Wait for services to be healthy
print_status "Waiting for services to start..."
sleep 30

# Check service status
print_status "Checking service status..."
docker-compose -f $DOCKER_COMPOSE_FILE ps

# Test MongoDB connection
print_status "Testing MongoDB connection..."
if docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    print_status "MongoDB health check passed"
else
    print_warning "MongoDB health check failed - check logs with: docker-compose -f $DOCKER_COMPOSE_FILE logs mongodb"
fi

# Test health endpoints
print_status "Testing application health endpoints..."
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    print_status "Backend health check passed"
else
    print_warning "Backend health check failed - check logs with: docker-compose -f $DOCKER_COMPOSE_FILE logs backend"
fi

if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    print_status "Frontend health check passed"
else
    print_warning "Frontend health check failed - check logs with: docker-compose -f $DOCKER_COMPOSE_FILE logs frontend"
fi

# Setup log rotation
print_status "Setting up log rotation..."
cat > logrotate.conf << EOF
/var/log/nginx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        [ -s /run/nginx.pid ] && kill -USR1 \$(cat /run/nginx.pid)
    endscript
}
EOF

sudo mv logrotate.conf /etc/logrotate.d/nginx-trixtech
sudo logrotate -f /etc/logrotate.d/nginx-trixtech

print_status "IP-based deployment completed successfully!"
echo ""
echo "🌐 Your application should be available at:"
if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
    echo "   Frontend: http://$SERVER_IP"
    echo "   Backend API: http://$SERVER_IP/api"
    echo "   Admin Panel: http://$SERVER_IP/admin"
else
    echo "   Frontend: http://YOUR_SERVER_IP (replace with your actual server IP)"
    echo "   Backend API: http://YOUR_SERVER_IP/api"
    echo "   Admin Panel: http://YOUR_SERVER_IP/admin"
fi
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose -f $DOCKER_COMPOSE_FILE logs -f"
echo "   Restart services: docker-compose -f $DOCKER_COMPOSE_FILE restart"
echo "   Stop services: docker-compose -f $DOCKER_COMPOSE_FILE down"
echo "   Update deployment: docker-compose -f $DOCKER_COMPOSE_FILE pull && docker-compose -f $DOCKER_COMPOSE_FILE up -d"
echo ""
print_warning "Next steps:"
echo "   1. Access your application using the IP address shown above"
echo "   2. Set up MongoDB Atlas database connection"
echo "   3. Configure domain and SSL when ready"
echo "   4. Update DNS records to point to this server"
echo ""
print_info "For domain-based deployment later, run: ./deploy-kvm1.sh"