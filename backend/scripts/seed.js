const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Service = require('../models/Service');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    console.log('Database connection verified...');

    // Check database connectivity and structure
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Found ${collections.length} collections in database`);

    // Verify essential collections exist
    const requiredCollections = ['users', 'services', 'bookings'];
    const existingCollections = collections.map(col => col.name);

    for (const collection of requiredCollections) {
      if (existingCollections.includes(collection)) {
        console.log(`✓ Collection '${collection}' exists`);
      } else {
        console.log(`⚠️  Collection '${collection}' not found - will be created when first used`);
      }
    }

    // Note: No data seeding - all data should be synced from external sources
    // or managed through the admin interface
    console.log('\n✓ Database structure verified!');
    console.log('No data seeding performed - sync data from external sources or use admin interface');

    process.exit(0);
  } catch (error) {
    console.error('Error verifying database:', error);
    process.exit(1);
  }
}

seedDatabase();
