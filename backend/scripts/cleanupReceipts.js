const fs = require('fs');
const path = require('path');

/**
 * Cleanup old receipt files that are older than specified days
 * This script should be run periodically (e.g., daily) via cron job
 */
async function cleanupOldReceipts() {
  const receiptsDir = path.join(__dirname, '../uploads/receipts');
  const maxAgeDays = 7; // Delete files older than 7 days
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  console.log(`Starting cleanup of receipt files older than ${maxAgeDays} days...`);

  try {
    // Check if directory exists
    if (!fs.existsSync(receiptsDir)) {
      console.log('Receipts directory does not exist, nothing to clean up');
      return;
    }

    const files = fs.readdirSync(receiptsDir);
    let deletedCount = 0;
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(receiptsDir, file);
      const stats = fs.statSync(filePath);

      // Check if file is older than max age
      if (Date.now() - stats.mtime.getTime() > maxAgeMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        totalSize += stats.size;
        console.log(`Deleted: ${file}`);
      }
    }

    console.log(`Cleanup completed: ${deletedCount} files deleted, ${Math.round(totalSize / 1024)} KB freed`);

  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

// Run cleanup if called directly
if (require.main === module) {
  cleanupOldReceipts()
    .then(() => {
      console.log('Cleanup script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { cleanupOldReceipts };