#!/bin/bash

# TRIXTECH Hostinger Deployment Script
# This script sets up the complete TRIXTECH booking system on Hostinger VPS
# Run this script on your fresh Hostinger VPS after getting SSH access

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root. Use: sudo bash deploy-to-hostinger.sh"
   exit 1
fi

log_info "🚀 Starting TRIXTECH deployment on Hostinger VPS..."

# Update system
log_info "📦 Updating system packages..."
apt update && apt upgrade -y
log_success "System updated successfully"

# Install essential packages
log_info "📦 Installing essential packages..."
apt install -y curl wget git htop ufw software-properties-common apt-transport-https ca-certificates gnupg lsb-release
log_success "Essential packages installed"

# Install Docker
log_info "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
rm get-docker.sh

# Install Docker Compose
log_info "🐳 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Add current user to docker group (if not root)
if [[ $SUDO_USER ]]; then
    usermod -aG docker $SUDO_USER
    log_info "Added $SUDO_USER to docker group"
fi

log_success "Docker and Docker Compose installed"

# Configure firewall
log_info "🔥 Configuring firewall..."
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # Grafana (monitoring)
ufw allow 9090/tcp  # Prometheus (monitoring)
ufw --force reload
log_success "Firewall configured"

# Create application directory
log_info "📁 Creating application directory..."
mkdir -p /opt/trixtech
cd /opt/trixtech
log_success "Application directory created"

# Clone repository (you'll need to upload files manually or provide git URL)
log_warning "⚠️  Please upload your TRIXTECH project files to /opt/trixtech/"
log_warning "   You can use SCP, SFTP, or git clone your repository"
log_warning "   Example: scp -r /path/to/local/project root@YOUR_VPS_IP:/opt/trixtech/"

read -p "Have you uploaded the project files? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Please upload your files and run this script again"
    exit 1
fi

# Navigate to project directory
cd /opt/trixtech

# Check if required files exist
required_files=("docker-compose.prod.yml" "backend/.env.production" "frontend/.env.production" "nginx/nginx.conf")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        log_error "Required file missing: $file"
        log_error "Please ensure all project files are uploaded correctly"
        exit 1
    fi
done
log_success "All required files found"

# Create necessary directories
log_info "📁 Creating necessary directories..."
mkdir -p nginx/ssl nginx/logs monitoring/grafana/dashboards monitoring/prometheus
log_success "Directories created"

# Generate secure passwords
log_info "🔐 Generating secure passwords..."
GRAFANA_PASSWORD=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -hex 32)
MONGO_ROOT_PASSWORD=$(openssl rand -base64 12)

# Create .env file for docker-compose
log_info "📝 Creating docker-compose environment file..."
cat > .env << EOF
# Docker Compose Environment Variables
MONGO_ROOT_USERNAME=trixtech_admin
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD
EOF
log_success "Docker environment file created"

# Display generated credentials
log_warning "🔑 IMPORTANT: Save these generated credentials:"
echo "Grafana Admin Password: $GRAFANA_PASSWORD"
echo "MongoDB Root Password: $MONGO_ROOT_PASSWORD"
echo "JWT Secret: $JWT_SECRET"
echo ""
log_warning "⚠️  You will need the JWT Secret for your backend configuration"

# Make scripts executable
log_info "🔧 Making scripts executable..."
chmod +x scripts/*.sh
chmod +x backend/scripts/*.sh
log_success "Scripts made executable"

# Build and start services
log_info "🐳 Building and starting Docker services..."
log_info "This may take several minutes..."

docker-compose -f docker-compose.prod.yml up -d --build

# Wait for services to start
log_info "⏳ Waiting for services to start..."
sleep 30

# Check service status
log_info "🔍 Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# Test services
log_info "🧪 Testing services..."

# Test backend health
if curl -f http://localhost:5000/api/health > /dev/null 2>&1; then
    log_success "✅ Backend health check passed"
else
    log_warning "⚠️  Backend health check failed - this is normal if database isn't configured yet"
fi

# Test frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    log_success "✅ Frontend is responding"
else
    log_warning "⚠️  Frontend not responding yet - still starting up"
fi

# Display access information
log_info "🎉 Deployment completed!"
echo ""
log_success "Your TRIXTECH system is running at:"
echo "  🌐 Frontend:    http://YOUR_DOMAIN.com (after domain setup)"
echo "  🔧 API:        http://api.YOUR_DOMAIN.com (after domain setup)"
echo "  📊 Grafana:    http://YOUR_DOMAIN.com:3001"
echo "  📈 Prometheus: http://YOUR_DOMAIN.com:9090"
echo ""
log_warning "Next steps:"
echo "1. 🏠 Set up your domain (see DOMAIN_SETUP_GUIDE.md)"
echo "2. 🔧 Configure environment variables with your actual values"
echo "3. 🗄️  Set up MongoDB Atlas database"
echo "4. 📧 Configure email service"
echo "5. 🔒 Set up SSL certificates"
echo ""
log_info "For detailed instructions, see:"
echo "  📖 DEPLOYMENT_HOSTINGER.md"
echo "  🌐 DOMAIN_SETUP_GUIDE.md"
echo ""
log_success "🚀 TRIXTECH deployment preparation complete!"

# Display logs location
log_info "📋 To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo "  docker-compose -f docker-compose.prod.yml logs -f backend"
echo "  docker-compose -f docker-compose.prod.yml logs -f frontend"