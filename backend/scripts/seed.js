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
        duration: 1, // 1 day
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
        duration: 1, // 1 day
        minOrder: 10,
        image: '', // No external images - use local uploads
        isAvailable: true,
        tags: ['catering', 'food', 'event'],
        features: ['Customized menus', 'Professional service', 'Setup and cleanup'],
      },
      // New inventory items as requested
      {
        name: 'Event Table',
        description: 'High-quality folding tables perfect for events and gatherings',
        category: 'furniture',
        serviceType: 'equipment',
        basePrice: 150,
        priceType: 'per-day',
        quantity: 50,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['table', 'furniture', 'rental', 'equipment'],
        features: ['Foldable design', 'Sturdy construction', 'Easy setup'],
        includedItems: ['Table', 'Setup instructions'],
        requirements: ['Clear access for delivery truck'],
      },
      {
        name: 'Event Tent',
        description: 'Weather-resistant tents for outdoor events and gatherings',
        category: 'tents-canopies',
        serviceType: 'equipment',
        basePrice: 500,
        priceType: 'per-day',
        quantity: 10,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['tent', 'canopy', 'outdoor', 'rental', 'equipment'],
        features: ['Weather-resistant', 'Easy assembly', 'Multiple sizes available'],
        includedItems: ['Tent frame', 'Canopy cover', 'Anchoring stakes', 'Setup instructions'],
        requirements: ['Open space for setup', 'Access for delivery truck'],
      },
      {
        name: 'Table Cloth',
        description: 'Elegant table linens to enhance your event presentation',
        category: 'linens-tableware',
        serviceType: 'supply',
        basePrice: 50,
        priceType: 'per-day',
        quantity: 100,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['tablecloth', 'linen', 'tableware', 'decoration'],
        features: ['Multiple colors', 'Easy care', 'Professional appearance'],
        includedItems: ['Table cloth', 'Fitting clips'],
        requirements: ['Compatible table size'],
      },
      {
        name: 'Chairs',
        description: 'Comfortable folding chairs for event seating',
        category: 'furniture',
        serviceType: 'equipment',
        basePrice: 25,
        priceType: 'per-day',
        quantity: 1445,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['chair', 'furniture', 'seating', 'rental', 'equipment'],
        features: ['Comfortable design', 'Stackable', 'Easy storage'],
        includedItems: ['Chair', 'Setup instructions'],
        requirements: ['Clear access for delivery truck'],
      },
      {
        name: '4ft Lifetime Table',
        description: 'Durable 4ft folding tables perfect for events',
        category: 'furniture',
        serviceType: 'equipment',
        basePrice: 50,
        priceType: 'per-day',
        quantity: 61,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['table', 'furniture', '4ft', 'lifetime', 'rental', 'equipment'],
        features: ['Durable construction', 'Foldable design', 'Easy setup'],
        includedItems: ['4ft Table', 'Setup instructions'],
        requirements: ['Clear access for delivery truck'],
      },
      {
        name: '6ft Lifetime Table',
        description: 'Durable 6ft folding tables perfect for events',
        category: 'furniture',
        serviceType: 'equipment',
        basePrice: 75,
        priceType: 'per-day',
        quantity: 47,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['table', 'furniture', '6ft', 'lifetime', 'rental', 'equipment'],
        features: ['Durable construction', 'Foldable design', 'Easy setup'],
        includedItems: ['6ft Table', 'Setup instructions'],
        requirements: ['Clear access for delivery truck'],
      },
      {
        name: '2m × 2m V Tent',
        description: '2m x 2m V-shaped tent for outdoor events',
        category: 'tents-canopies',
        serviceType: 'equipment',
        basePrice: 300,
        priceType: 'per-day',
        quantity: 20,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['tent', 'canopy', '2m', 'v-tent', 'outdoor', 'rental', 'equipment'],
        features: ['Weather-resistant', 'V-shaped design', 'Easy assembly'],
        includedItems: ['Tent frame', 'Canopy cover', 'Anchoring stakes', 'Setup instructions'],
        requirements: ['Open space for setup', 'Access for delivery truck'],
      },
      {
        name: '3m × 3m Retractable Tent',
        description: '3m x 3m retractable tent for outdoor events',
        category: 'tents-canopies',
        serviceType: 'equipment',
        basePrice: 500,
        priceType: 'per-day',
        quantity: 18,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['tent', 'canopy', '3m', 'retractable', 'outdoor', 'rental', 'equipment'],
        features: ['Weather-resistant', 'Retractable design', 'Easy assembly'],
        includedItems: ['Tent frame', 'Retractable canopy', 'Anchoring stakes', 'Setup instructions'],
        requirements: ['Open space for setup', 'Access for delivery truck'],
      },
      {
        name: 'Sound System',
        description: 'Professional sound system rental with speakers and mixer',
        category: 'sound-system',
        serviceType: 'equipment',
        basePrice: 2000,
        priceType: 'per-day',
        quantity: 5,
        image: '',
        isAvailable: true,
        deliveryRequired: true,
        tags: ['sound system', 'audio', 'speakers', 'rental', 'equipment'],
        features: ['Professional quality', 'Wireless microphones', 'Complete setup'],
        includedItems: ['Speakers', 'Mixer', 'Microphones', 'Cables', 'Setup and operation'],
        requirements: ['Power supply access', 'Technical support available'],
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
