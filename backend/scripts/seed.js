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

    // Demo users removed for security

    // Create sample services
    const services = [
      {
        name: 'Birthday Party Setup',
        description: 'Professional birthday party decoration and setup',
        category: 'party',
        price: 299,
        duration: 120,
        image: 'https://via.placeholder.com/300x200?text=Birthday+Party',
        isAvailable: true,
      },
      {
        name: 'Wedding Planning',
        description: 'Complete wedding event planning and coordination',
        category: 'wedding',
        price: 1500,
        duration: 480,
        image: 'https://via.placeholder.com/300x200?text=Wedding',
        isAvailable: true,
      },
      {
        name: 'Corporate Event',
        description: 'Professional corporate event management and setup',
        category: 'corporate',
        price: 750,
        duration: 240,
        image: 'https://via.placeholder.com/300x200?text=Corporate+Event',
        isAvailable: true,
      },
      {
        name: 'House Cleaning',
        description: 'Professional deep cleaning service for residential spaces',
        category: 'cleaning',
        price: 199,
        duration: 180,
        image: 'https://via.placeholder.com/300x200?text=House+Cleaning',
        isAvailable: true,
      },
      {
        name: 'Office Cleaning',
        description: 'Commercial office space cleaning and maintenance',
        category: 'cleaning',
        price: 350,
        duration: 120,
        image: 'https://via.placeholder.com/300x200?text=Office+Cleaning',
        isAvailable: true,
      },
      {
        name: 'Catering Service',
        description: 'Professional catering for events of all sizes',
        category: 'other',
        price: 500,
        duration: 180,
        image: 'https://via.placeholder.com/300x200?text=Catering',
        isAvailable: true,
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
