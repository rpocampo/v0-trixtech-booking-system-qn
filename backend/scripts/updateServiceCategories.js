const mongoose = require('mongoose');
const Service = require('../models/Service');
require('dotenv').config();

async function updateServiceCategories() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    console.log('Connected to MongoDB');

    // Define event keywords in names
    const eventKeywords = ['birthday', 'wedding', 'funeral', 'corporate', 'party', 'debut', 'christening'];

    // Update services with event names
    const result = await Service.updateMany(
      { name: { $regex: new RegExp(eventKeywords.join('|'), 'i') } },
      { $set: { serviceCategory: 'event' } }
    );

    console.log(`Updated ${result.modifiedCount} event services`);

    // Update remaining services to 'product'
    const productResult = await Service.updateMany(
      { serviceCategory: { $exists: false } },
      { $set: { serviceCategory: 'product' } }
    );

    console.log(`Updated ${productResult.modifiedCount} product services`);

    console.log('Service categories updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error updating service categories:', error);
    process.exit(1);
  }
}

updateServiceCategories();