#!/bin/bash

# MongoDB Backup Script for TRIXTECH
# This script creates backups of the MongoDB database running in Docker

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="trixtech_backup_$TIMESTAMP"
CONTAINER_NAME="trixtech-mongodb-ip"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}[INFO]${NC} Starting MongoDB backup..."

# Check if MongoDB container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo -e "${RED}[ERROR]${NC} MongoDB container '$CONTAINER_NAME' is not running"
    exit 1
fi

# Create backup using mongodump
echo -e "${GREEN}[INFO]${NC} Creating backup: $BACKUP_NAME"

docker exec "$CONTAINER_NAME" mongodump \
    --username trixtech_user \
    --password trixtech2024! \
    --authenticationDatabase trixtech_prod \
    --db trixtech_prod \
    --out "/tmp/$BACKUP_NAME"

# Copy backup from container to host
docker cp "$CONTAINER_NAME:/tmp/$BACKUP_NAME" "$BACKUP_DIR/"

# Clean up backup from container
docker exec "$CONTAINER_NAME" rm -rf "/tmp/$BACKUP_NAME"

# Compress the backup
echo -e "${GREEN}[INFO]${NC} Compressing backup..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

# Calculate backup size
BACKUP_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)

echo -e "${GREEN}[SUCCESS]${NC} MongoDB backup completed!"
echo -e "${GREEN}[INFO]${NC} Backup location: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo -e "${GREEN}[INFO]${NC} Backup size: $BACKUP_SIZE"
echo -e "${GREEN}[INFO]${NC} Timestamp: $TIMESTAMP"

# Keep only last 7 backups (optional cleanup)
echo -e "${YELLOW}[INFO]${NC} Cleaning up old backups (keeping last 7)..."
ls -t *.tar.gz | tail -n +8 | xargs -r rm -f

echo -e "${GREEN}[SUCCESS]${NC} Backup process completed successfully!"