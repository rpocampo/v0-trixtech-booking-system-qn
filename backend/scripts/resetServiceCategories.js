const mongoose = require('mongoose');
const Service = require('../models/Service');
require('dotenv').config();

async function resetServiceCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    // Reset all services to serviceCategory 'product'
    const result = await Service.updateMany(
      {},
      { $set: { serviceCategory: 'product' } }
    );

    console.log(`Reset ${result.modifiedCount} services to serviceCategory 'product'`);

    console.log('Service categories reset successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting service categories:', error);
    process.exit(1);
  }
}

resetServiceCategories();