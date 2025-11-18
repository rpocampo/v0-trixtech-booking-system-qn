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

    // Clear existing data
    await User.deleteMany({});
    await Service.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@trixtech.com',
      password: 'admin123',
      role: 'admin',
      phone: '+1 (555) 000-0001',
      address: '123 Admin Street, Admin City',
    });
    await adminUser.save();
    console.log('Admin user created');

    // Create sample customer
    const customerUser = new User({
      name: 'Sample Customer',
      email: 'customer@trixtech.com',
      password: 'customer123',
      role: 'customer',
      phone: '+1 (555) 000-0002',
      address: '456 Customer Ave, Customer Town',
    });
    await customerUser.save();
    console.log('Sample customer created');

    // Create sample services
    const services = [
      {
        name: 'Birthday Party Setup',
        description: 'Professional birthday party decoration and setup with balloons, banners, and themed arrangements',
        category: 'party',
        price: 299,
        duration: 120,
        image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'Wedding Planning',
        description: 'Complete wedding event planning and coordination with floral arrangements and venue setup',
        category: 'wedding',
        price: 1500,
        duration: 480,
        image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'Corporate Event',
        description: 'Professional corporate event management with AV setup, catering, and team building activities',
        category: 'corporate',
        price: 750,
        duration: 240,
        image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'House Cleaning',
        description: 'Professional deep cleaning service for residential spaces including kitchen, bathrooms, and living areas',
        category: 'cleaning',
        price: 199,
        duration: 180,
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'Office Cleaning',
        description: 'Commercial office space cleaning and maintenance with sanitization and waste management',
        category: 'cleaning',
        price: 350,
        duration: 120,
        image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'Catering Service',
        description: 'Professional catering for events of all sizes with customized menus and dietary accommodations',
        category: 'other',
        price: 500,
        duration: 180,
        image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=300&fit=crop',
        isAvailable: true,
      },
      {
        name: 'Tents',
        description: 'High-quality tents for outdoor events and gatherings with weather protection and elegant setup',
        category: 'equipment',
        price: 150,
        duration: 240,
        image: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 5,
      },
      {
        name: 'Chairs',
        description: 'Comfortable folding chairs for events and gatherings with padded seats and sturdy frames',
        category: 'equipment',
        price: 25,
        duration: 240,
        image: 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 50,
      },
      {
        name: 'Tables',
        description: 'Durable folding tables for events and dining with adjustable heights and easy storage',
        category: 'equipment',
        price: 50,
        duration: 240,
        image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 20,
      },
      {
        name: 'Table Cloths',
        description: 'Elegant table cloths in various colors and sizes for event decoration and table settings',
        category: 'equipment',
        price: 20,
        duration: 240,
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        isAvailable: true,
        quantity: 30,
      },
    ];

    await Service.insertMany(services);
    console.log('Sample services created');

    console.log('\n✓ Database seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seedDatabase();
