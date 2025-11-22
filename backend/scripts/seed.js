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

    console.log('Initializing database...');

    // Always clear and recreate basic data for testing
    await User.deleteMany({});
    await Service.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user (always create if doesn't exist)
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      const adminUser = new User({
        name: process.env.ADMIN_NAME || 'System Administrator',
        email: process.env.ADMIN_EMAIL || 'admin@trixtech.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        role: 'admin',
        phone: process.env.ADMIN_PHONE || '',
        address: process.env.ADMIN_ADDRESS || '',
      });
      await adminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    // Create demo customer only if seeding demo data
    const existingCustomer = await User.findOne({ email: 'demo@trixtech.com' });
    if (!existingCustomer) {
      const customerUser = new User({
        name: 'Demo Customer',
        email: 'demo@trixtech.com',
        password: 'demo123',
        role: 'customer',
        phone: '+63 (999) 123-4567',
        address: '123 Demo Street, Demo City, Philippines',
      });
      await customerUser.save();
      console.log('Demo customer created');
    }

    // Create basic services (always create for testing)
    const services = [
      // Basic service examples
      {
        name: 'Event Photography',
        description: 'Professional photography service for events and celebrations',
        category: 'photography',
        serviceType: 'service',
        basePrice: 5000,
        priceType: 'flat-rate',
        duration: 240, // 4 hours
        image: '', // No external images - use local uploads
        isAvailable: true,
        tags: ['photography', 'event', 'professional'],
        features: ['High-resolution images', 'Online gallery', 'Professional editing'],
      },
      {
        name: 'Event Catering',
        description: 'Professional catering service for events with customized menus',
        category: 'catering',
        serviceType: 'service',
        basePrice: 500,
        priceType: 'per-person',
        duration: 180, // 3 hours
        minOrder: 10,
        image: '', // No external images - use local uploads
        isAvailable: true,
        tags: ['catering', 'food', 'event'],
        features: ['Customized menus', 'Professional service', 'Setup and cleanup'],
      },
      {
        name: 'Sound System Rental',
        description: 'Professional sound system rental with setup and operation',
        category: 'sound-system',
        serviceType: 'service',
        basePrice: 3000,
        priceType: 'flat-rate',
        duration: 480, // 8 hours
        image: '', // No external images - use local uploads
        isAvailable: true,
        tags: ['sound system', 'audio', 'rental'],
        features: ['Professional equipment', 'Setup and operation', 'Technical support'],
      },
    ];

    // Always create basic services for testing
    const existingServices = await Service.find({});
    if (existingServices.length === 0) {
      await Service.insertMany(services);
      console.log(`${services.length} basic services created for testing`);
    } else {
      console.log(`${existingServices.length} services already exist`);
    }

    console.log('\n✓ Database initialized successfully!');
    console.log('Basic services and admin user created for testing');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
