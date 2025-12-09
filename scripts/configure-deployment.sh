#!/bin/bash

# TRIXTECH Configuration Script
# This script helps configure your deployment after setting up the domain
# Run this on your VPS after the initial deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if running in project directory
if [[ ! -f "docker-compose.prod.yml" ]]; then
    log_error "Please run this script from the project root directory"
    exit 1
fi

log_info "🔧 TRIXTECH Deployment Configuration"
echo ""

# Domain configuration
read -p "Enter your domain name (without https://): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    log_error "Domain name is required"
    exit 1
fi

log_info "Configuring for domain: $DOMAIN"

# Update nginx configuration
log_info "📝 Updating nginx configuration..."
sed -i "s/yourdomain\.com/$DOMAIN/g" nginx/nginx.conf
sed -i "s/api\.yourdomain\.com/api.$DOMAIN/g" nginx/nginx.conf
log_success "Nginx configuration updated"

# Update backend environment
log_info "📝 Updating backend environment..."
cp backend/.env.production backend/.env

# Replace placeholders in backend .env
sed -i "s/PLACEHOLDER_DOMAIN/$DOMAIN/g" backend/.env

log_warning "⚠️  Please update the following placeholders in backend/.env:"
echo "  - PLACEHOLDER_USERNAME: Your MongoDB Atlas username"
echo "  - PLACEHOLDER_PASSWORD: Your MongoDB Atlas password"
echo "  - PLACEHOLDER_CLUSTER: Your MongoDB Atlas cluster"
echo "  - PLACEHOLDER_JWT_SECRET_32_CHARS_MINIMUM: A secure 32+ character JWT secret"
echo "  - PLACEHOLDER_EMAIL: Your Gmail address"
echo "  - PLACEHOLDER_GMAIL_APP_PASSWORD: Your Gmail app password"
echo ""

# Update frontend environment
log_info "📝 Updating frontend environment..."
cp frontend/.env.production frontend/.env.local

# Replace placeholders in frontend .env
sed -i "s/PLACEHOLDER_DOMAIN/$DOMAIN/g" frontend/.env.local

log_success "Environment files configured with domain: $DOMAIN"

# Optional configurations
echo ""
read -p "Do you want to configure optional services? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then

    # Google Analytics
    read -p "Enter Google Analytics Tracking ID (leave empty to skip): " GA_ID
    if [[ -n "$GA_ID" ]]; then
        sed -i "s/PLACEHOLDER_GA_TRACKING_ID/$GA_ID/g" frontend/.env.local
        log_success "Google Analytics configured"
    fi

    # Sentry
    read -p "Enter Sentry DSN (leave empty to skip): " SENTRY_DSN
    if [[ -n "$SENTRY_DSN" ]]; then
        sed -i "s/PLACEHOLDER_SENTRY_DSN/$SENTRY_DSN/g" backend/.env
        sed -i "s/PLACEHOLDER_SENTRY_DSN/$SENTRY_DSN/g" frontend/.env.local
        log_success "Sentry error tracking configured"
    fi

    # Social login
    read -p "Configure social login? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Facebook App ID: " FB_APP_ID
        read -p "Google Client ID: " GOOGLE_CLIENT_ID

        if [[ -n "$FB_APP_ID" ]]; then
            sed -i "s/PLACEHOLDER_FACEBOOK_APP_ID/$FB_APP_ID/g" frontend/.env.local
        fi
        if [[ -n "$GOOGLE_CLIENT_ID" ]]; then
            sed -i "s/PLACEHOLDER_GOOGLE_CLIENT_ID/$GOOGLE_CLIENT_ID/g" frontend/.env.local
        fi
        log_success "Social login configured"
    fi

    # reCAPTCHA
    read -p "Enter reCAPTCHA Site Key (leave empty to skip): " RECAPTCHA_KEY
    if [[ -n "$RECAPTCHA_KEY" ]]; then
        sed -i "s/PLACEHOLDER_RECAPTCHA_SITE_KEY/$RECAPTCHA_KEY/g" frontend/.env.local
        log_success "reCAPTCHA configured"
    fi
fi

# MongoDB Atlas setup helper
echo ""
log_info "🗄️  MongoDB Atlas Setup Helper:"
echo "1. Go to https://cloud.mongodb.com"
echo "2. Create a new cluster (M0 is free)"
echo "3. Create a database user"
echo "4. Whitelist your VPS IP address"
echo "5. Get your connection string"
echo ""
read -p "Do you have your MongoDB Atlas connection string ready? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your MongoDB Atlas connection string: " MONGO_URI
    if [[ -n "$MONGO_URI" ]]; then
        # Extract components from MongoDB URI
        # mongodb+srv://username:password@cluster.mongodb.net/database
        sed -i "s|mongodb+srv://PLACEHOLDER_USERNAME:PLACEHOLDER_PASSWORD@PLACEHOLDER_CLUSTER\.mongodb\.net/trixtech_prod.*|$MONGO_URI|g" backend/.env
        log_success "MongoDB connection configured"
    fi
fi

# Email setup helper
echo ""
log_info "📧 Email Setup Helper:"
echo "For Gmail:"
echo "1. Enable 2-factor authentication"
echo "2. Generate an App Password: https://myaccount.google.com/apppasswords"
echo "3. Use your Gmail address and the App Password"
echo ""

# Restart services
echo ""
read -p "Restart services with new configuration? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "🔄 Restarting services..."
    docker-compose -f docker-compose.prod.yml down
    docker-compose -f docker-compose.prod.yml up -d --build
    log_success "Services restarted"
fi

# SSL setup reminder
echo ""
log_success "🎉 Configuration completed!"
echo ""
log_info "Next steps:"
echo "1. 🏠 Complete domain setup (see DOMAIN_SETUP_GUIDE.md)"
echo "2. 🔒 Set up SSL certificates in Hostinger hPanel"
echo "3. 🧪 Test your application at https://$DOMAIN"
echo "4. 📊 Access monitoring at https://$DOMAIN:3001"
echo ""
log_warning "⚠️  Remember to:"
echo "  - Update any remaining PLACEHOLDER values in your .env files"
echo "  - Test all functionality after configuration"
echo "  - Set up automated backups"
echo ""

# Display current status
log_info "📊 Current deployment status:"
echo "  🌐 Domain: $DOMAIN"
echo "  🔧 Services: $(docker-compose -f docker-compose.prod.yml ps --services --filter "status=running" | wc -l) running"
echo "  📝 Config files: Ready"
echo "  🗄️  Database: $(grep -q "PLACEHOLDER" backend/.env && echo "Needs configuration" || echo "Configured")"
echo "  📧 Email: $(grep -q "PLACEHOLDER_EMAIL" backend/.env && echo "Needs configuration" || echo "Configured")"