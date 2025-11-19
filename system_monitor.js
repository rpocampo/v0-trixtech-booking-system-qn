const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class SystemMonitor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.lastCheck = null;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    console.log(logMessage);

    // Log to file
    const logFile = path.join(__dirname, 'system_monitor.log');
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  async checkFileSystem() {
    this.log('Checking file system integrity...');

    // Check for critical files
    const criticalFiles = [
      'frontend/package.json',
      'backend/package.json',
      'backend/server.js',
      'frontend/app/layout.tsx'
    ];

    for (const file of criticalFiles) {
      if (!fs.existsSync(file)) {
        this.issues.push(`Missing critical file: ${file}`);
      }
    }

    // Check for large files that might indicate issues
    const largeFiles = this.findLargeFiles('.', 10 * 1024 * 1024); // 10MB
    if (largeFiles.length > 0) {
      this.warnings.push(`Large files detected: ${largeFiles.join(', ')}`);
    }

    this.log(`File system check completed. Found ${this.issues.length} issues, ${this.warnings.length} warnings.`);
  }

  findLargeFiles(dir, maxSize) {
    const largeFiles = [];

    function scan(currentDir) {
      const files = fs.readdirSync(currentDir);

      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
          scan(filePath);
        } else if (stat.isFile() && stat.size > maxSize) {
          largeFiles.push(filePath);
        }
      }
    }

    scan(dir);
    return largeFiles;
  }

  async checkDependencies() {
    this.log('Checking dependencies...');

    return new Promise((resolve) => {
      // Check frontend dependencies
      exec('cd frontend && npm audit --audit-level=moderate', (error, stdout, stderr) => {
        if (error && error.code > 0) {
          const vulnerabilities = stdout.match(/found (\d+) vulnerabilities/g);
          if (vulnerabilities) {
            this.issues.push(`Frontend security vulnerabilities: ${vulnerabilities[0]}`);
          }
        }

        // Check backend dependencies
        exec('cd backend && npm audit --audit-level=moderate', (error2, stdout2, stderr2) => {
          if (error2 && error2.code > 0) {
            const vulnerabilities2 = stdout2.match(/found (\d+) vulnerabilities/g);
            if (vulnerabilities2) {
              this.issues.push(`Backend security vulnerabilities: ${vulnerabilities2[0]}`);
            }
          }

          this.log('Dependencies check completed.');
          resolve();
        });
      });
    });
  }

  async checkBuild() {
    this.log('Checking build processes...');

    return new Promise((resolve) => {
      exec('cd frontend && npm run build', (error, stdout, stderr) => {
        if (error) {
          this.issues.push('Frontend build failed');
          if (stderr) {
            this.issues.push(`Build error: ${stderr.substring(0, 200)}...`);
          }
        } else {
          this.log('Frontend build successful');
        }
        resolve();
      });
    });
  }

  async checkDatabase() {
    this.log('Checking database connectivity...');

    return new Promise((resolve) => {
      exec('cd backend && node test_system.js', (error, stdout, stderr) => {
        if (error) {
          this.issues.push('Database connectivity test failed');
        } else if (stdout.includes('ALL SYSTEM TESTS PASSED')) {
          this.log('Database connectivity verified');
        } else {
          this.warnings.push('Database test completed with warnings');
        }
        resolve();
      });
    });
  }

  async checkAPIEndpoints() {
    this.log('Checking API endpoints...');

    const endpoints = [
      { url: 'http://localhost:5000/api/health', description: 'Health check' },
      { url: 'http://localhost:5000/api/services', description: 'Services endpoint' }
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url);
        if (!response.ok) {
          this.warnings.push(`${endpoint.description} returned ${response.status}`);
        }
      } catch (error) {
        this.issues.push(`${endpoint.description} unreachable: ${error.message}`);
      }
    }

    this.log('API endpoints check completed.');
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        issues: this.issues.length,
        warnings: this.warnings.length,
        status: this.issues.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION'
      },
      issues: this.issues,
      warnings: this.warnings,
      recommendations: []
    };

    // Generate recommendations
    if (this.issues.length > 0) {
      report.recommendations.push('Review and fix critical issues immediately');
    }

    if (this.warnings.length > 0) {
      report.recommendations.push('Address warnings to improve system stability');
    }

    if (this.issues.length === 0 && this.warnings.length === 0) {
      report.recommendations.push('System is healthy - continue monitoring');
    }

    // Save report
    const reportPath = path.join(__dirname, 'system_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return report;
  }

  async runFullScan() {
    this.log('Starting comprehensive system scan...');
    this.issues = [];
    this.warnings = [];
    this.lastCheck = new Date();

    await this.checkFileSystem();
    await this.checkDependencies();
    await this.checkBuild();
    await this.checkDatabase();
    await this.checkAPIEndpoints();

    const report = await this.generateReport();

    this.log(`Scan completed. Status: ${report.summary.status}`);
    this.log(`Issues: ${report.summary.issues}, Warnings: ${report.summary.warnings}`);

    return report;
  }

  async startContinuousMonitoring(intervalMinutes = 60) {
    this.log(`Starting continuous monitoring (every ${intervalMinutes} minutes)...`);

    const runScan = async () => {
      const report = await this.runFullScan();

      if (report.summary.issues > 0) {
        this.log('🚨 CRITICAL ISSUES DETECTED - Immediate attention required!', 'error');
      } else if (report.summary.warnings > 0) {
        this.log('⚠️  Warnings detected - Review recommended', 'warning');
      } else {
        this.log('✅ System healthy', 'success');
      }
    };

    // Run initial scan
    await runScan();

    // Schedule recurring scans
    setInterval(runScan, intervalMinutes * 60 * 1000);
  }
}

// CLI interface
if (require.main === module) {
  const monitor = new SystemMonitor();

  if (process.argv[2] === '--continuous') {
    const interval = parseInt(process.argv[3]) || 60;
    monitor.startContinuousMonitoring(interval);
  } else {
    monitor.runFullScan().then((report) => {
      console.log('\n📊 SCAN REPORT SUMMARY:');
      console.log('='.repeat(50));
      console.log(`Status: ${report.summary.status}`);
      console.log(`Issues: ${report.summary.issues}`);
      console.log(`Warnings: ${report.summary.warnings}`);

      if (report.issues.length > 0) {
        console.log('\n🚨 CRITICAL ISSUES:');
        report.issues.forEach(issue => console.log(`  • ${issue}`));
      }

      if (report.warnings.length > 0) {
        console.log('\n⚠️  WARNINGS:');
        report.warnings.forEach(warning => console.log(`  • ${warning}`));
      }

      if (report.recommendations.length > 0) {
        console.log('\n💡 RECOMMENDATIONS:');
        report.recommendations.forEach(rec => console.log(`  • ${rec}`));
      }

      process.exit(report.summary.issues > 0 ? 1 : 0);
    });
  }
}

module.exports = SystemMonitor;