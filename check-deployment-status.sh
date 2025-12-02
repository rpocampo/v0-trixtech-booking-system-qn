#!/bin/bash

# TRIXTECH Deployment Status Checker
# Check the health and status of deployed services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

DOCKER_COMPOSE_FILE="docker-compose-ip.yml"

print_header() {
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║${NC}              🔍 TRIXTECH DEPLOYMENT STATUS                 ${PURPLE}║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
}

print_service_status() {
    local service=$1
    local status=$2
    local details=$3

    if [ "$status" = "healthy" ]; then
        echo -e "  ${GREEN}✓${NC} $service: ${GREEN}$status${NC} $details"
    elif [ "$status" = "running" ]; then
        echo -e "  ${BLUE}●${NC} $service: ${BLUE}$status${NC} $details"
    elif [ "$status" = "stopped" ]; then
        echo -e "  ${RED}✗${NC} $service: ${RED}$status${NC} $details"
    else
        echo -e "  ${YELLOW}⚠${NC} $service: ${YELLOW}$status${NC} $details"
    fi
}

print_header

# Check if docker-compose file exists
if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
    echo -e "\n${RED}✗ Docker compose file not found: $DOCKER_COMPOSE_FILE${NC}"
    echo -e "${YELLOW}Are you in the correct project directory?${NC}"
    exit 1
fi

echo -e "\n${BLUE}🔍 Checking deployment status...${NC}\n"

# Get server IP
SERVER_IP=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || \
           curl -s --connect-timeout 5 icanhazip.com 2>/dev/null || \
           curl -s --connect-timeout 5 ipinfo.io/ip 2>/dev/null || \
           hostname -I | awk '{print $1}' 2>/dev/null || echo "Unknown")

echo -e "${BLUE}🌐 Server Information:${NC}"
echo -e "  IP Address: $SERVER_IP"
echo -e "  Project: $(basename $(pwd))"
echo -e "  Docker Compose: $DOCKER_COMPOSE_FILE"

# Check Docker services
echo -e "\n${BLUE}🐳 Docker Services:${NC}"
if docker-compose -f $DOCKER_COMPOSE_FILE ps >/dev/null 2>&1; then
    # Parse service status
    docker-compose -f $DOCKER_COMPOSE_FILE ps --format "table {{.Name}}\t{{.State}}\t{{.Ports}}" | tail -n +2 | while read line; do
        service_name=$(echo $line | awk '{print $1}')
        service_state=$(echo $line | awk '{print $2}')

        # Clean up service name
        service_name=$(echo $service_name | sed 's/trixtech-//' | sed 's/-ip//')

        if [ "$service_state" = "Up" ]; then
            print_service_status "$service_name" "running" ""
        else
            print_service_status "$service_name" "stopped" "($service_state)"
        fi
    done
else
    echo -e "  ${RED}✗ Unable to check Docker services${NC}"
fi

# Check service health
echo -e "\n${BLUE}💚 Service Health:${NC}"

# MongoDB health
if docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongosh --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
    # Get database stats
    db_stats=$(docker-compose -f $DOCKER_COMPOSE_FILE exec -T mongodb mongosh --eval "db.stats()" --quiet 2>/dev/null | grep -E "(collections|objects|storageSize)" | head -3 | tr '\n' ' ' | sed 's/"/ /g' || echo "")
    print_service_status "MongoDB" "healthy" "$db_stats"
else
    print_service_status "MongoDB" "unhealthy" ""
fi

# Backend health
if curl -f --connect-timeout 5 http://localhost:5000/api/health >/dev/null 2>&1; then
    print_service_status "Backend API" "healthy" "(port 5000)"
else
    print_service_status "Backend API" "unhealthy" "(port 5000)"
fi

# Frontend health
if curl -f --connect-timeout 5 http://localhost:3000/api/health >/dev/null 2>&1; then
    print_service_status "Frontend" "healthy" "(port 3000)"
else
    print_service_status "Frontend" "unhealthy" "(port 3000)"
fi

# Nginx health (check if port 80 is responding)
if curl -f --connect-timeout 5 http://localhost >/dev/null 2>&1; then
    print_service_status "Nginx" "healthy" "(port 80)"
else
    print_service_status "Nginx" "unhealthy" "(port 80)"
fi

# Check resource usage
echo -e "\n${BLUE}📊 Resource Usage:${NC}"
if command -v docker &> /dev/null && docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep trixtech >/dev/null 2>&1; then
    echo -e "  ${BLUE}Container Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep trixtech | while read line; do
        container=$(echo $line | awk '{print $1}' | sed 's/trixtech-//' | sed 's/-ip//')
        cpu=$(echo $line | awk '{print $2}')
        mem=$(echo $line | awk '{print $3}')
        echo -e "    $container: CPU ${cpu}, RAM ${mem}"
    done
else
    echo -e "  ${YELLOW}⚠ Unable to get detailed resource usage${NC}"
fi

# Check disk usage
echo -e "\n${BLUE}💾 Disk Usage:${NC}"
if [ -d "mongodb" ]; then
    db_size=$(du -sh mongodb/ 2>/dev/null | cut -f1 || echo "Unknown")
    echo -e "  Database: $db_size"
fi

backup_count=$(find mongodb/backups/ -name "*.tar.gz" 2>/dev/null | wc -l 2>/dev/null || echo "0")
echo -e "  Backups: $backup_count files"

# Access URLs
echo -e "\n${BLUE}🌐 Access URLs:${NC}"
if [ "$SERVER_IP" != "Unknown" ] && [ "$SERVER_IP" != "" ]; then
    echo -e "  Frontend: http://$SERVER_IP"
    echo -e "  Admin: http://$SERVER_IP/admin"
    echo -e "  API: http://$SERVER_IP/api"
else
    echo -e "  ${YELLOW}⚠ Server IP could not be detected${NC}"
    echo -e "  Frontend: http://YOUR_SERVER_IP"
    echo -e "  Admin: http://YOUR_SERVER_IP/admin"
    echo -e "  API: http://YOUR_SERVER_IP/api"
fi

# Recent logs
echo -e "\n${BLUE}📋 Recent Activity:${NC}"
if [ -f "mongodb/backups/last_backup.txt" ]; then
    last_backup=$(cat mongodb/backups/last_backup.txt 2>/dev/null || echo "Unknown")
    echo -e "  Last backup: $last_backup"
else
    echo -e "  Last backup: None found"
fi

# System uptime
uptime_info=$(uptime -p 2>/dev/null || echo "Unknown")
echo -e "  System uptime: $uptime_info"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Status check completed!${NC}"