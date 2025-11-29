const mongoose = require('mongoose');
const Service = require('../models/Service');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected for duration update');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Update all service durations to 1 day
const updateServiceDurations = async () => {
  try {
    console.log('Starting service duration update...');

    // Update all services to have duration of 1 day
    const result = await Service.updateMany(
      {}, // Update all services
      { $set: { duration: 1 } } // Set duration to 1 day
    );

    console.log(`✅ Successfully updated ${result.modifiedCount} services`);
    console.log(`📊 Total services matched: ${result.matchedCount}`);

    // Verify the update by checking a few services
    const sampleServices = await Service.find({}).limit(5).select('name duration serviceType');
    console.log('\n📋 Sample updated services:');
    sampleServices.forEach(service => {
      console.log(`  - ${service.name}: ${service.duration} day(s) (${service.serviceType})`);
    });

  } catch (error) {
    console.error('❌ Error updating service durations:', error);
    process.exit(1);
  }
};

// Main execution
const main = async () => {
  await connectDB();
  await updateServiceDurations();

  console.log('\n🎉 Service duration update completed successfully!');
  console.log('All services now have a duration of 1 day.');

  process.exit(0);
};

// Run the script
main().catch(error => {
  console.error('💥 Script execution failed:', error);
  process.exit(1);
});