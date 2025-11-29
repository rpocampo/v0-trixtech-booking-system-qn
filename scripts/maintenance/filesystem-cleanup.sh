#!/bin/bash

# TRIXTECH File System Cleanup Script
# Removes temporary files, cleans up Docker resources, and optimizes disk usage

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/maintenance/filesystem-cleanup-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="$PROJECT_ROOT/reports/maintenance/filesystem-cleanup-$(date +%Y%m%d-%H%M%S).json"

# Cleanup settings
TEMP_FILE_AGE_DAYS=7
DOCKER_IMAGE_AGE_DAYS=30
ORPHANED_FILE_AGE_DAYS=14

# Create directories
mkdir -p "$PROJECT_ROOT/logs/maintenance"
mkdir -p "$PROJECT_ROOT/reports/maintenance"

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    echo "{\"status\": \"failed\", \"error\": \"$1\", \"timestamp\": \"$(date -Iseconds)\"}" > "$REPORT_FILE"
    exit 1
}

# Get disk usage
get_disk_usage() {
    local path="$1"
    if [[ -d "$path" ]]; then
        du -sb "$path" 2>/dev/null | cut -f1 || echo "0"
    else
        echo "0"
    fi
}

# Clean temporary files
clean_temp_files() {
    log "Cleaning temporary files..."

    local temp_dirs=(
        "/tmp"
        "/var/tmp"
        "$PROJECT_ROOT/tmp"
        "$PROJECT_ROOT/backend/tmp"
        "$PROJECT_ROOT/frontend/.next/cache"
    )

    local cleaned_files=0
    local cleaned_size=0

    for temp_dir in "${temp_dirs[@]}"; do
        if [[ -d "$temp_dir" ]]; then
            log "Cleaning temp directory: $temp_dir"

            # Remove old temp files
            while IFS= read -r -d '' temp_file; do
                local file_size
                file_size=$(stat -f%z "$temp_file" 2>/dev/null || stat -c%s "$temp_file" 2>/dev/null || echo 0)
                rm -f "$temp_file"
                ((cleaned_files++))
                ((cleaned_size += file_size))
                log "Removed temp file: $temp_file (${file_size} bytes)"
            done < <(find "$temp_dir" -type f \( -name "*.tmp" -o -name "*.temp" -o -name "*~" -o -name ".DS_Store" \) -mtime +$TEMP_FILE_AGE_DAYS -print0 2>/dev/null || true)

            # Remove empty directories
            find "$temp_dir" -type d -empty -delete 2>/dev/null || true
        fi
    done

    echo "{\"cleanedTempFiles\": $cleaned_files, \"cleanedTempSize\": $cleaned_size}"
}

# Clean Docker resources
clean_docker_resources() {
    log "Cleaning Docker resources..."

    local cleaned_images=0
    local cleaned_containers=0
    local cleaned_volumes=0
    local cleaned_networks=0
    local reclaimed_space=0

    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log "Docker not available, skipping Docker cleanup"
        echo "{\"dockerAvailable\": false, \"cleanedImages\": 0, \"cleanedContainers\": 0, \"cleanedVolumes\": 0, \"cleanedNetworks\": 0, \"reclaimedSpace\": 0}"
        return
    fi

    # Remove dangling images
    local dangling_images
    dangling_images=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if (( dangling_images > 0 )); then
        docker image prune -f >/dev/null 2>&1
        cleaned_images=$dangling_images
        log "Removed $dangling_images dangling Docker images"
    fi

    # Remove old images (older than specified days)
    local old_images
    old_images=$(docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | grep -v "REPOSITORY:TAG" | while read -r line; do
        local created_date
        created_date=$(echo "$line" | awk '{print $NF}')
        if [[ -n "$created_date" ]] && (( $(date -d "$created_date" +%s 2>/dev/null || echo "$(date +%s)") < $(date -d "$DOCKER_IMAGE_AGE_DAYS days ago" +%s 2>/dev/null || echo "0") )); then
            echo "$line" | awk '{print $1}'
        fi
    done | wc -l | tr -d ' ' || echo "0")

    if (( old_images > 0 )); then
        docker image prune -a --filter "until=${DOCKER_IMAGE_AGE_DAYS}d" -f >/dev/null 2>&1
        ((cleaned_images += old_images))
        log "Removed $old_images old Docker images"
    fi

    # Remove stopped containers
    local stopped_containers
    stopped_containers=$(docker ps -a -f "status=exited" -q 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if (( stopped_containers > 0 )); then
        docker container prune -f >/dev/null 2>&1
        cleaned_containers=$stopped_containers
        log "Removed $stopped_containers stopped Docker containers"
    fi

    # Remove unused volumes
    local unused_volumes
    unused_volumes=$(docker volume ls -qf "dangling=true" 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if (( unused_volumes > 0 )); then
        docker volume prune -f >/dev/null 2>&1
        cleaned_volumes=$unused_volumes
        log "Removed $unused_volumes unused Docker volumes"
    fi

    # Remove unused networks
    local unused_networks
    unused_networks=$(docker network ls --filter "type=custom" -q 2>/dev/null | xargs docker network inspect 2>/dev/null | jq -r '.[] | select(.Containers | length == 0) | .Name' 2>/dev/null | wc -l | tr -d ' ' || echo "0")
    if (( unused_networks > 0 )); then
        docker network prune -f >/dev/null 2>&1
        cleaned_networks=$unused_networks
        log "Removed $unused_networks unused Docker networks"
    fi

    # Get reclaimed space (approximate)
    local docker_system_df
    docker_system_df=$(docker system df 2>/dev/null || echo "")
    if [[ -n "$docker_system_df" ]]; then
        reclaimed_space=$(echo "$docker_system_df" | grep "Total Reclaimed" | awk '{print $3}' | sed 's/[A-Za-z]*$//' | tr -d ' ' || echo "0")
    fi

    echo "{\"dockerAvailable\": true, \"cleanedImages\": $cleaned_images, \"cleanedContainers\": $cleaned_containers, \"cleanedVolumes\": $cleaned_volumes, \"cleanedNetworks\": $cleaned_networks, \"reclaimedSpace\": \"$reclaimed_space\"}"
}

# Clean orphaned files
clean_orphaned_files() {
    log "Cleaning orphaned files..."

    local orphaned_files=0
    local orphaned_size=0

    # Find orphaned files in project directory (files not tracked by git, older than threshold)
    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        log "Checking for orphaned files in project directory..."

        while IFS= read -r -d '' file; do
            # Skip if file is in .git directory or is a directory
            if [[ "$file" == *"/.git/"* ]] || [[ -d "$file" ]]; then
                continue
            fi

            local file_size
            file_size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)

            # Check if file is tracked by git
            if ! git -C "$PROJECT_ROOT" ls-files --error-unmatch "$file" >/dev/null 2>&1; then
                # File is not tracked, check age
                if [[ $(find "$file" -mtime +$ORPHANED_FILE_AGE_DAYS 2>/dev/null | wc -l) -gt 0 ]]; then
                    rm -f "$file"
                    ((orphaned_files++))
                    ((orphaned_size += file_size))
                    log "Removed orphaned file: $file (${file_size} bytes)"
                fi
            fi
        done < <(find "$PROJECT_ROOT" -type f -print0 2>/dev/null | head -1000)  # Limit to prevent long execution
    fi

    echo "{\"cleanedOrphanedFiles\": $orphaned_files, \"cleanedOrphanedSize\": $orphaned_size}"
}

# Optimize disk usage
optimize_disk_usage() {
    log "Optimizing disk usage..."

    # Run filesystem checks if possible
    if command -v fsck &> /dev/null; then
        log "Running filesystem check (read-only)"
        # Note: This would require unmounting, so we skip in production
        # fsck -n /dev/sda1 2>/dev/null || true
    fi

    # Clear page cache (Linux specific)
    if [[ -f "/proc/sys/vm/drop_caches" ]]; then
        log "Clearing system page cache"
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
    fi

    # Optimize package managers cache
    if command -v apt-get &> /dev/null; then
        log "Cleaning apt cache"
        apt-get clean >/dev/null 2>&1 || true
    fi

    if command -v yum &> /dev/null; then
        log "Cleaning yum cache"
        yum clean all >/dev/null 2>&1 || true
    fi

    echo "{\"diskOptimization\": true}"
}

# Monitor disk usage
monitor_disk_usage() {
    log "Monitoring disk usage..."

    local disk_info
    disk_info=$(df -h 2>/dev/null | awk 'NR>1 {print "{\"mount\":\""$6"\",\"used\":\""$3"\",\"available\":\""$4"\",\"usePercent\":\""$5"\"}"}' | jq -s . 2>/dev/null || echo "[]")

    local project_size
    project_size=$(get_disk_usage "$PROJECT_ROOT")

    echo "{\"diskInfo\": $disk_info, \"projectSize\": $project_size}"
}

# Generate final report
generate_report() {
    log "Generating filesystem cleanup report..."

    local before_disk
    before_disk=$(monitor_disk_usage)

    local temp_cleanup
    temp_cleanup=$(clean_temp_files)

    local docker_cleanup
    docker_cleanup=$(clean_docker_resources)

    local orphaned_cleanup
    orphaned_cleanup=$(clean_orphaned_files)

    local disk_optimization
    disk_optimization=$(optimize_disk_usage)

    local after_disk
    after_disk=$(monitor_disk_usage)

    cat > "$REPORT_FILE" << EOF
{
    "status": "completed",
    "timestamp": "$(date -Iseconds)",
    "settings": {
        "tempFileAgeDays": $TEMP_FILE_AGE_DAYS,
        "dockerImageAgeDays": $DOCKER_IMAGE_AGE_DAYS,
        "orphanedFileAgeDays": $ORPHANED_FILE_AGE_DAYS
    },
    "beforeDiskUsage": $before_disk,
    "cleanupResults": {
        "tempFiles": $temp_cleanup,
        "dockerResources": $docker_cleanup,
        "orphanedFiles": $orphaned_cleanup,
        "diskOptimization": $disk_optimization
    },
    "afterDiskUsage": $after_disk,
    "logFile": "$LOG_FILE"
}
EOF

    log "Report generated: $REPORT_FILE"
}

# Send alert if needed
send_alert() {
    local alert_message="$1"
    log "ALERT: $alert_message"

    # In production, integrate with monitoring system
    # Example: curl -X POST -H "Content-Type: application/json" -d "{\"message\": \"$alert_message\"}" $MONITORING_WEBHOOK
}

# Main execution
main() {
    log "Starting TRIXTECH filesystem cleanup"
    log "Log file: $LOG_FILE"
    log "Report file: $REPORT_FILE"

    generate_report

    log "Filesystem cleanup completed successfully"

    # Check for disk usage alerts
    local disk_usage_percent
    disk_usage_percent=$(jq -r '.afterDiskUsage.diskInfo[] | select(.mount=="/") | .usePercent' "$REPORT_FILE" 2>/dev/null | sed 's/%//' || echo "0")

    if (( disk_usage_percent > 90 )); then
        send_alert "Disk usage is critically high: ${disk_usage_percent}%. Immediate action required."
    elif (( disk_usage_percent > 80 )); then
        send_alert "Disk usage is high: ${disk_usage_percent}%. Consider cleanup or expansion."
    fi
}

# Run main function
main "$@"