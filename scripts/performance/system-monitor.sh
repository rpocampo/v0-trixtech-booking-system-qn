#!/bin/bash

# TRIXTECH System Resource Monitor
# Monitors CPU, memory, disk I/O usage, network performance, and container resource usage

set -e

# Configuration
ENV=${ENV:-dev}
PROMETHEUS_METRICS_FILE=${PROMETHEUS_METRICS_FILE:-/tmp/system_metrics.prom}
REPORT_DIR=${REPORT_DIR:-reports}
THRESHOLD_CPU=${THRESHOLD_CPU:-80}  # %
THRESHOLD_MEMORY=${THRESHOLD_MEMORY:-85}  # %
THRESHOLD_DISK=${THRESHOLD_DISK:-90}  # %

# Create report directory
mkdir -p "$REPORT_DIR"

REPORT_FILE="$REPORT_DIR/system_performance_$(date +%Y%m%d_%H%M%S).txt"

# Function to get CPU usage
get_cpu_usage() {
  # Try different methods for CPU usage
  if command -v top >/dev/null 2>&1; then
    # Linux top command
    top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}'
  elif command -v wmic >/dev/null 2>&1; then
    # Windows wmic
    wmic cpu get loadpercentage | grep -Eo '[0-9]+' | head -1
  else
    echo "0"
  fi
}

# Function to get memory usage
get_memory_usage() {
  if command -v free >/dev/null 2>&1; then
    # Linux free command
    free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}'
  elif command -v wmic >/dev/null 2>&1; then
    # Windows wmic
    used=$(wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value | grep -E 'TotalVisibleMemorySize|FreePhysicalMemory' | sed 's/.*=//' | paste - - | awk '{print $1 - $2}')
    total=$(wmic OS get TotalVisibleMemorySize /value | grep -o '[0-9]*')
    echo "scale=2; $used / $total * 100" | bc 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Function to get disk usage
get_disk_usage() {
  local mount_point=${1:-/}
  if command -v df >/dev/null 2>&1; then
    df "$mount_point" | tail -1 | awk '{print $5}' | sed 's/%//'
  else
    echo "0"
  fi
}

# Function to get network stats
get_network_stats() {
  if command -v ss >/dev/null 2>&1; then
    # Use ss for connection count
    connections=$(ss -tuln | wc -l)
    echo "$connections"
  elif command -v netstat >/dev/null 2>&1; then
    connections=$(netstat -tuln | wc -l)
    echo "$connections"
  else
    echo "0"
  fi
}

# Function to get disk I/O stats
get_disk_io() {
  if command -v iostat >/dev/null 2>&1; then
    # Get disk I/O utilization
    iostat -d 1 1 | grep -A 1 "Device" | tail -1 | awk '{print $NF}' 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Function to get container stats (if Docker is available)
get_container_stats() {
  if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
    # Get container count and basic stats
    container_count=$(docker ps | wc -l)
    container_count=$((container_count - 1))  # Subtract header

    # Get CPU and memory usage for running containers
    docker_stats=$(docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemPerc}}" | tail -n +2)
    echo "$container_count|$docker_stats"
  else
    echo "0|"
  fi
}

# Collect system metrics
echo "Collecting system resource metrics..."

cpu_usage=$(get_cpu_usage)
memory_usage=$(get_memory_usage)
disk_usage=$(get_disk_usage)
network_connections=$(get_network_stats)
disk_io=$(get_disk_io)
container_info=$(get_container_stats)

# Parse container info
container_count=$(echo "$container_info" | cut -d'|' -f1)
container_stats=$(echo "$container_info" | cut -d'|' -f2)

# Get load average
load_average=$(uptime | awk -F'load average:' '{ print $2 }' | sed 's/,//g' | awk '{print $1}' 2>/dev/null || echo "0")

# Generate Prometheus metrics
prometheus_metrics="# HELP system_cpu_usage CPU usage percentage
# TYPE system_cpu_usage gauge
system_cpu_usage{env=\"$ENV\"} $cpu_usage
"

prometheus_metrics="${prometheus_metrics}# HELP system_memory_usage Memory usage percentage
# TYPE system_memory_usage gauge
system_memory_usage{env=\"$ENV\"} $memory_usage
"

prometheus_metrics="${prometheus_metrics}# HELP system_disk_usage Disk usage percentage
# TYPE system_disk_usage gauge
system_disk_usage{mount=\"/\",env=\"$ENV\"} $disk_usage
"

prometheus_metrics="${prometheus_metrics}# HELP system_network_connections Network connections count
# TYPE system_network_connections gauge
system_network_connections{env=\"$ENV\"} $network_connections
"

prometheus_metrics="${prometheus_metrics}# HELP system_disk_io Disk I/O utilization percentage
# TYPE system_disk_io gauge
system_disk_io{env=\"$ENV\"} $disk_io
"

prometheus_metrics="${prometheus_metrics}# HELP system_load_average System load average
# TYPE system_load_average gauge
system_load_average{env=\"$ENV\"} $load_average
"

prometheus_metrics="${prometheus_metrics}# HELP system_containers_running Number of running containers
# TYPE system_containers_running gauge
system_containers_running{env=\"$ENV\"} $container_count
"

# Write Prometheus metrics
echo -e "$prometheus_metrics" > "$PROMETHEUS_METRICS_FILE"

# Generate detailed report
{
  echo "======================================"
  echo "TRIXTECH System Resource Report"
  echo "======================================"
  echo "Generated: $(date)"
  echo "Environment: $ENV"
  echo ""
  echo "SYSTEM RESOURCE METRICS:"
  echo "------------------------"
  printf "%-20s %-15s %-10s\n" "Resource" "Usage" "Status"
  printf "%-20s %-15s %-10s\n" "--------" "-----" "------"

  cpu_status=$([ $(echo "$cpu_usage > $THRESHOLD_CPU" | bc -l 2>/dev/null) ] && echo "HIGH" || echo "OK")
  printf "%-20s %-15s %-10s\n" "CPU Usage" "${cpu_usage}%" "$cpu_status"

  mem_status=$([ $(echo "$memory_usage > $THRESHOLD_MEMORY" | bc -l 2>/dev/null) ] && echo "HIGH" || echo "OK")
  printf "%-20s %-15s %-10s\n" "Memory Usage" "${memory_usage}%" "$mem_status"

  disk_status=$([ $(echo "$disk_usage > $THRESHOLD_DISK" | bc -l 2>/dev/null) ] && echo "HIGH" || echo "OK")
  printf "%-20s %-15s %-10s\n" "Disk Usage (/)" "${disk_usage}%" "$disk_status"

  printf "%-20s %-15s %-10s\n" "Disk I/O" "${disk_io}%" "N/A"
  printf "%-20s %-15s %-10s\n" "Load Average" "$load_average" "N/A"
  printf "%-20s %-15s %-10s\n" "Network Connections" "$network_connections" "N/A"
  echo ""
  echo "CONTAINER METRICS:"
  echo "------------------"
  echo "Running Containers: $container_count"
  if [ -n "$container_stats" ]; then
    echo ""
    echo "Container Resource Usage:"
    echo "$container_stats" | while IFS= read -r line; do
      echo "  $line"
    done
  fi

  echo ""
  echo "PERFORMANCE ANALYSIS:"
  echo "---------------------"
  warnings=0

  if [ $(echo "$cpu_usage > $THRESHOLD_CPU" | bc -l 2>/dev/null) ]; then
    echo "⚠️  WARNING: CPU usage (${cpu_usage}%) exceeds threshold (${THRESHOLD_CPU}%)"
    ((warnings++))
  fi

  if [ $(echo "$memory_usage > $THRESHOLD_MEMORY" | bc -l 2>/dev/null) ]; then
    echo "⚠️  WARNING: Memory usage (${memory_usage}%) exceeds threshold (${THRESHOLD_MEMORY}%)"
    ((warnings++))
  fi

  if [ $(echo "$disk_usage > $THRESHOLD_DISK" | bc -l 2>/dev/null) ]; then
    echo "⚠️  WARNING: Disk usage (${disk_usage}%) exceeds threshold (${THRESHOLD_DISK}%)"
    ((warnings++))
  fi

  if [ $warnings -eq 0 ]; then
    echo "✅ All system resources are within acceptable limits"
  fi

  echo ""
  echo "RECOMMENDATIONS:"
  echo "----------------"
  if [ $(echo "$cpu_usage > 70" | bc -l 2>/dev/null) ]; then
    echo "- Consider optimizing CPU-intensive processes"
    echo "- Check for runaway processes: ps aux --sort=-%cpu | head"
  fi

  if [ $(echo "$memory_usage > 80" | bc -l 2>/dev/null) ]; then
    echo "- Monitor memory usage trends"
    echo "- Consider increasing RAM or optimizing memory usage"
    echo "- Check memory hogs: ps aux --sort=-%mem | head"
  fi

  if [ $(echo "$disk_usage > 85" | bc -l 2>/dev/null) ]; then
    echo "- Clean up disk space"
    echo "- Archive old log files and data"
    echo "- Check disk usage: du -h / | sort -hr | head -10"
  fi

  if [ "$container_count" -gt 0 ]; then
    echo "- Monitor container resource limits"
    echo "- Consider scaling containers if needed"
  fi

} > "$REPORT_FILE"

echo "System resource monitoring completed."
echo "Report saved to: $REPORT_FILE"
echo "Prometheus metrics exported to: $PROMETHEUS_METRICS_FILE"

# Exit with error code if thresholds exceeded
if [ $(echo "$cpu_usage > $THRESHOLD_CPU" | bc -l 2>/dev/null) ] || \
   [ $(echo "$memory_usage > $THRESHOLD_MEMORY" | bc -l 2>/dev/null) ] || \
   [ $(echo "$disk_usage > $THRESHOLD_DISK" | bc -l 2>/dev/null) ]; then
  echo "System resource thresholds exceeded. Check report for details."
  exit 1
fi