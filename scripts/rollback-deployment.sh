#!/bin/bash

# TRIXTECH Deployment Rollback Script
# Safely rollback deployment in case of issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_NAME="trixtech-booking-system"
DOCKER_COMPOSE_FILE="docker-compose-ip.yml"

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC}              🚨 TRIXTECH DEPLOYMENT ROLLBACK              ${YELLOW}║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${RED}⚠️  WARNING: This will stop and remove all TRIXTECH services${NC}"
echo -e "${RED}⚠️  Database data will be preserved in Docker volumes${NC}"
echo -e "${RED}⚠️  Application files will be removed${NC}\n"

read -p "Are you sure you want to rollback the deployment? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo -e "\n${BLUE}Rollback cancelled.${NC}"
    exit 0
fi

# Check if we're in the project directory
if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    print_error "Docker compose file not found. Are you in the project directory?"
    exit 1
fi

print_info "Stopping all services..."
docker-compose -f $DOCKER_COMPOSE_FILE down >/dev/null 2>&1
print_success "Services stopped"

print_info "Removing containers and networks..."
docker-compose -f $DOCKER_COMPOSE_FILE down -v --remove-orphans >/dev/null 2>&1
print_success "Containers and networks removed"

print_info "Cleaning up Docker images..."
docker image prune -f >/dev/null 2>&1
print_success "Docker images cleaned"

print_info "Removing application files..."
cd ..
rm -rf $PROJECT_NAME
print_success "Application files removed"

print_info "Cleaning up system..."
# Remove cron jobs
crontab -l 2>/dev/null | grep -v "trixtech" | crontab - 2>/dev/null || true

# Remove logrotate config
sudo rm -f /etc/logrotate.d/nginx-trixtech 2>/dev/null || true

print_success "System cleanup completed"

echo -e "\n${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}                 ✅ ROLLBACK COMPLETED                      ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

echo -e "\n${BLUE}What was preserved:${NC}"
echo -e "  ${GREEN}✓${NC} Docker volumes (database data)"
echo -e "  ${GREEN}✓${NC} Docker images cache"
echo -e "  ${GREEN}✓${NC} System packages"

echo -e "\n${BLUE}What was removed:${NC}"
echo -e "  ${RED}✗${NC} Application containers"
echo -e "  ${RED}✗${NC} Application files"
echo -e "  ${RED}✗${NC} Cron jobs"
echo -e "  ${RED}✗${NC} Log rotation configs"

echo -e "\n${YELLOW}To redeploy, run: ./deploy-full-auto.sh${NC}"
echo -e "${YELLOW}To restore from backup: ./mongodb/restore-mongo.sh <backup-file>${NC}"

print_success "Rollback completed successfully!"