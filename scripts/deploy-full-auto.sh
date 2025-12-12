#!/bin/bash

# TRIXTECH Complete Automated Deployment Script
# One-command deployment for Hostinger KVM1
# Handles everything from server setup to live application

set -e

# Configuration
REPO_URL="https://github.com/your-username/trixtech-booking-system.git"
PROJECT_NAME="trixtech-booking-system"
DOCKER_COMPOSE_FILE="docker-compose-ip.yml"
DEPLOYMENT_TYPE="ip-based"

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Progress tracking
STEPS_TOTAL=12
CURRENT_STEP=0

# Function to print step header
print_step() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    echo -e "\n${CYAN}┌────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC} ${WHITE}Step $CURRENT_STEP/$STEPS_TOTAL:${NC} $1"
    echo -e "${CYAN}└────────────────────────────────────────────────────────────────┘${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Function to print error
print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Function to check command success
check_command() {
    if [ $? -eq 0 ]; then
        print_success "$1"
    else
        print_error "$1"
        exit 1
    fi
}

# Function to get server IP
get_server_ip() {
    # Try multiple methods to get public IP
    IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
         curl -s --connect-timeout 5 icanhazip.com 2>/dev/null || \
         curl -s --connect-timeout 5 ipinfo.io/ip 2>/dev/null || \
         hostname -I | awk '{print $1}' 2>/dev/null)

    if [ -z "$IP" ]; then
        print_warning "Could not detect public IP automatically"
        IP="YOUR_SERVER_IP"
    fi

    echo "$IP"
}

# Function to check system requirements
check_system_requirements() {
    print_step "Checking System Requirements"

    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root for security reasons"
        exit 1
    fi

    # Check CPU cores
    CPU_CORES=$(nproc 2>/dev/null || echo "1")
    if [ "$CPU_CORES" -lt 1 ]; then
        print_error "Insufficient CPU cores. KVM1 should have at least 1 core."
        exit 1
    fi
    print_info "CPU cores: $CPU_CORES"

    # Check RAM
    TOTAL_RAM=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $2}' || echo "4096")
    if [ "$TOTAL_RAM" -lt 4000 ]; then
        print_warning "Available RAM: ${TOTAL_RAM}MB. KVM1 should have 4096MB RAM."
    else
        print_info "Total RAM: ${TOTAL_RAM}MB"
    fi

    # Check disk space
    DISK_SPACE=$(df / 2>/dev/null | tail -1 | awk '{print $4}' || echo "52428800")
    DISK_SPACE_GB=$((DISK_SPACE / 1024 / 1024))
    if [ "$DISK_SPACE_GB" -lt 40 ]; then
        print_warning "Available disk space: ${DISK_SPACE_GB}GB. KVM1 should have 50GB."
    else
        print_info "Disk space: ${DISK_SPACE_GB}GB"
    fi

    # Check OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_info "OS: $PRETTY_NAME"
    else
        print_info "OS: Unknown"
    fi

    print_success "System requirements check completed"
}

# Function to setup server
setup_server() {
    print_step "Setting Up Server Environment"

    # Update system
    print_info "Updating system packages..."
    sudo apt update -y >/dev/null 2>&1
    check_command "System update completed"

    # Install essential tools
    print_info "Installing essential tools..."
    sudo apt install -y curl wget git htop ufw software-properties-common apt-transport-https ca-certificates gnupg lsb-release >/dev/null 2>&1
    check_command "Essential tools installed"

    # Install Docker if not present
    if ! command -v docker &> /dev/null; then
        print_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh >/dev/null 2>&1
        sudo sh get-docker.sh >/dev/null 2>&1
        sudo usermod -aG docker $USER >/dev/null 2>&1
        print_success "Docker installed"
    else
        print_info "Docker already installed"
    fi

    # Install Docker Compose if not present
    if ! command -v docker-compose &> /dev/null; then
        print_info "Installing Docker Compose..."
        sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose >/dev/null 2>&1
        sudo chmod +x /usr/local/bin/docker-compose >/dev/null 2>&1
        print_success "Docker Compose installed"
    else
        print_info "Docker Compose already installed"
    fi

    # Configure firewall
    print_info "Configuring firewall..."
    sudo ufw --force enable >/dev/null 2>&1
    sudo ufw allow OpenSSH >/dev/null 2>&1
    sudo ufw allow 80 >/dev/null 2>&1
    sudo ufw allow 443 >/dev/null 2>&1
    check_command "Firewall configured"

    print_success "Server setup completed"
}

# Function to clone repository
clone_repository() {
    print_step "Cloning TRIXTECH Repository"

    # Remove existing directory if it exists
    if [ -d "$PROJECT_NAME" ]; then
        print_warning "Removing existing $PROJECT_NAME directory"
        rm -rf "$PROJECT_NAME"
    fi

    # Clone repository
    print_info "Cloning repository from $REPO_URL"
    if git clone "$REPO_URL" >/dev/null 2>&1; then
        print_success "Repository cloned successfully"
    else
        print_error "Failed to clone repository"
        exit 1
    fi

    # Navigate to project directory
    cd "$PROJECT_NAME"
    print_info "Changed to project directory: $(pwd)"
}

# Function to configure environment
configure_environment() {
    print_step "Configuring Environment Variables"

    # Get server IP
    SERVER_IP=$(get_server_ip)
    print_info "Detected server IP: $SERVER_IP"

    # Create backend environment file
    if [ ! -f "backend/.env" ]; then
        print_info "Setting up backend environment..."
        cp backend/.env.production backend/.env

        # Update MongoDB connection for local database
        sed -i 's|MONGODB_URI=.*|MONGODB_URI=mongodb://trixtech_user:trixtech2024!@mongodb:27017/trixtech_prod?authSource=trixtech_prod|' backend/.env

        # Update frontend URL
        if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
            sed -i "s|FRONTEND_URL=.*|FRONTEND_URL=http://$SERVER_IP|" backend/.env
        fi

        print_success "Backend environment configured"
    else
        print_info "Backend environment already exists"
    fi

    # Create frontend environment file
    if [ ! -f "frontend/.env.local" ]; then
        print_info "Setting up frontend environment..."
        cp frontend/.env.production frontend/.env.local

        # Update API and app URLs
        if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
            sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http://$SERVER_IP|" frontend/.env.local
            sed -i "s|NEXT_PUBLIC_SOCKET_URL=.*|NEXT_PUBLIC_SOCKET_URL=http://$SERVER_IP|" frontend/.env.local
            sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=http://$SERVER_IP|" frontend/.env.local
        fi

        print_success "Frontend environment configured"
    else
        print_info "Frontend environment already exists"
    fi
}

# Function to create necessary directories
create_directories() {
    print_step "Creating Necessary Directories"

    sudo mkdir -p /var/log/nginx
    sudo mkdir -p nginx/ssl
    sudo mkdir -p nginx/logs
    sudo mkdir -p mongodb/backups

    sudo chown -R $USER:$USER nginx/
    sudo chown -R $USER:$USER mongodb/

    print_success "Directories created and permissions set"
}

# Function to deploy application
deploy_application() {
    print_step "Deploying TRIXTECH Application"

    # Build Docker images
    print_info "Building Docker images..."
    docker-compose -f $DOCKER_COMPOSE_FILE build --no-cache >/dev/null 2>&1
    check_command "Docker images built successfully"

    # Start services
    print_info "Starting services..."
    docker-compose -f $DOCKER_COMPOSE_FILE up -d >/dev/null 2>&1
    check_command "Services started successfully"

    # Wait for services to be healthy
    print_info "Waiting for services to initialize..."
    sleep 45

    print_success "Application deployed successfully"
}

# Function to run health checks
run_health_checks() {
    print_step "Running Health Checks"

    local max_attempts=12
    local attempt=1

    print_info "Checking MongoDB health..."
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            print_success "MongoDB is healthy"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "MongoDB health check failed after $max_attempts attempts"
                return 1
            fi
            print_info "MongoDB not ready yet, attempt $attempt/$max_attempts..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done

    attempt=1
    print_info "Checking backend health..."
    while [ $attempt -le $max_attempts ]; do
        if curl -f --connect-timeout 10 http://localhost:5000/api/health >/dev/null 2>&1; then
            print_success "Backend is healthy"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "Backend health check failed after $max_attempts attempts"
                return 1
            fi
            print_info "Backend not ready yet, attempt $attempt/$max_attempts..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done

    attempt=1
    print_info "Checking frontend health..."
    while [ $attempt -le $max_attempts ]; do
        if curl -f --connect-timeout 10 http://localhost:3000/api/health >/dev/null 2>&1; then
            print_success "Frontend is healthy"
            break
        else
            if [ $attempt -eq $max_attempts ]; then
                print_error "Frontend health check failed after $max_attempts attempts"
                return 1
            fi
            print_info "Frontend not ready yet, attempt $attempt/$max_attempts..."
            sleep 10
            attempt=$((attempt + 1))
        fi
    done

    print_success "All health checks passed"
}

# Function to setup monitoring and maintenance
setup_monitoring() {
    print_step "Setting Up Monitoring & Maintenance"

    # Setup log rotation
    print_info "Setting up log rotation..."
    cat > logrotate.conf << 'EOF'
/var/log/nginx/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 www-data adm
    postrotate
        [ -s /run/nginx.pid ] && kill -USR1 $(cat /run/nginx.pid)
    endscript
}
EOF

    sudo mv logrotate.conf /etc/logrotate.d/nginx-trixtech 2>/dev/null || true
    sudo logrotate -f /etc/logrotate.d/nginx-trixtech 2>/dev/null || true

    # Setup backup cron job
    print_info "Setting up automated backups..."
    mkdir -p mongodb/backups

    # Add backup cron job (daily at 2 AM)
    (crontab -l 2>/dev/null; echo "0 2 * * * cd $(pwd) && ./mongodb/backup-mongo.sh >/dev/null 2>&1") | crontab -

    print_success "Monitoring and maintenance setup completed"
}

# Function to display deployment summary
display_summary() {
    print_step "Deployment Summary"

    SERVER_IP=$(get_server_ip)

    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                          🎉 DEPLOYMENT COMPLETE!                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "${WHITE}🌐 Access URLs:${NC}"
    if [ "$SERVER_IP" != "YOUR_SERVER_IP" ]; then
        echo -e "   ${GREEN}Frontend:${NC} http://$SERVER_IP"
        echo -e "   ${GREEN}Admin Panel:${NC} http://$SERVER_IP/admin"
        echo -e "   ${GREEN}API:${NC} http://$SERVER_IP/api"
    else
        echo -e "   ${YELLOW}Frontend:${NC} http://YOUR_SERVER_IP (replace with your actual IP)"
        echo -e "   ${YELLOW}Admin Panel:${NC} http://YOUR_SERVER_IP/admin"
        echo -e "   ${YELLOW}API:${NC} http://YOUR_SERVER_IP/api"
    fi

    echo -e "\n${WHITE}🔧 Services Status:${NC}"
    echo -e "   ${GREEN}✓${NC} MongoDB (Local Database)"
    echo -e "   ${GREEN}✓${NC} Backend API (Node.js)"
    echo -e "   ${GREEN}✓${NC} Frontend (Next.js)"
    echo -e "   ${GREEN}✓${NC} Nginx (Reverse Proxy)"

    echo -e "\n${WHITE}🛠️ Useful Commands:${NC}"
    echo -e "   View logs: ${CYAN}docker-compose -f $DOCKER_COMPOSE_FILE logs -f${NC}"
    echo -e "   Restart services: ${CYAN}docker-compose -f $DOCKER_COMPOSE_FILE restart${NC}"
    echo -e "   Stop services: ${CYAN}docker-compose -f $DOCKER_COMPOSE_FILE down${NC}"
    echo -e "   Backup database: ${CYAN}./mongodb/backup-mongo.sh${NC}"

    echo -e "\n${WHITE}📊 Resource Usage:${NC}"
    echo -e "   Backend: 512MB RAM, 0.5 CPU cores"
    echo -e "   Frontend: 512MB RAM, 0.5 CPU cores"
    echo -e "   MongoDB: 256MB RAM, 0.3 CPU cores"
    echo -e "   Nginx: 128MB RAM, 0.2 CPU cores"
    echo -e "   ${GREEN}Total: ~1.4GB RAM (well within KVM1 limits)${NC}"

    echo -e "\n${WHITE}🔐 Default Admin Credentials:${NC}"
    echo -e "   Create your first admin account through the registration form"

    echo -e "\n${WHITE}📞 Next Steps:${NC}"
    echo -e "   1. Access your application using the URLs above"
    echo -e "   2. Register as an admin user"
    echo -e "   3. Configure services and settings"
    echo -e "   4. Set up domain and SSL when ready"

    echo -e "\n${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}🚀 TRIXTECH is now live on your KVM1 server!${NC}"
    echo -e "${PURPLE}═══════════════════════════════════════════════════════════════════════════════${NC}"
}

# Function to handle errors and cleanup
error_handler() {
    print_error "Deployment failed at step $CURRENT_STEP"

    echo -e "\n${WHITE}🔧 Troubleshooting:${NC}"
    echo -e "   Check logs: ${CYAN}docker-compose -f $DOCKER_COMPOSE_FILE logs${NC}"
    echo -e "   Restart deployment: ${CYAN}./deploy-full-auto.sh${NC}"
    echo -e "   Clean restart: ${CYAN}docker-compose -f $DOCKER_COMPOSE_FILE down && ./deploy-full-auto.sh${NC}"

    exit 1
}

# Function to check if deployment already exists
check_existing_deployment() {
    if [ -d "$PROJECT_NAME" ]; then
        echo -e "${YELLOW}⚠ Existing deployment detected${NC}"
        read -p "Remove existing deployment and start fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Removing existing deployment..."
            # Stop any running containers
            if [ -f "$PROJECT_NAME/$DOCKER_COMPOSE_FILE" ]; then
                cd "$PROJECT_NAME"
                docker-compose -f $DOCKER_COMPOSE_FILE down >/dev/null 2>&1 || true
                cd ..
            fi
            rm -rf "$PROJECT_NAME"
            print_success "Existing deployment removed"
        else
            print_info "Keeping existing deployment. Exiting."
            exit 0
        fi
    fi
}

# Main deployment function
main() {
    # Trap errors
    trap error_handler ERR

    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                    🚀 TRIXTECH AUTOMATED DEPLOYMENT                       ║"
    echo "║                          Hostinger KVM1 Edition                           ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    echo -e "${WHITE}This script will automatically:${NC}"
    echo -e "  ${CYAN}•${NC} Set up your KVM1 server environment"
    echo -e "  ${CYAN}•${NC} Deploy TRIXTECH with local MongoDB"
    echo -e "  ${CYAN}•${NC} Configure all services and networking"
    echo -e "  ${CYAN}•${NC} Run health checks and verification"
    echo -e "  ${CYAN}•${NC} Provide access information"
    echo -e "\n${YELLOW}Estimated deployment time: 10-15 minutes${NC}\n"

    # Check for existing deployment
    check_existing_deployment

    # Run deployment steps
    check_system_requirements
    setup_server
    clone_repository
    configure_environment
    create_directories
    deploy_application
    run_health_checks
    setup_monitoring
    display_summary

    print_success "🎉 Automated deployment completed successfully!"
}

# Run main function
main "$@"