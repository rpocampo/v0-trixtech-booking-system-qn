const mongoose = require('mongoose');
const Notification = require('../models/Notification');

async function findServiceUnavailableNotification() {
  try {
    console.log('Finding Service Unavailable notifications...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find notifications with "Service Unavailable" title
    const serviceUnavailableNotifications = await Notification.find({
      title: 'Service Unavailable'
    });

    console.log(`Found ${serviceUnavailableNotifications.length} "Service Unavailable" notifications:`);

    serviceUnavailableNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ID: ${notification._id}`);
      console.log(`   Title: ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Type: ${notification.type}`);
      console.log(`   Created: ${notification.createdAt}`);
      console.log('   ---');
    });

    // Also search for notifications containing "not available in your area"
    const areaNotifications = await Notification.find({
      message: { $regex: 'not available in your area', $options: 'i' }
    });

    console.log(`\nFound ${areaNotifications.length} notifications with "not available in your area":`);

    areaNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ID: ${notification._id}`);
      console.log(`   Title: ${notification.title}`);
      console.log(`   Message: ${notification.message}`);
      console.log(`   Type: ${notification.type}`);
      console.log(`   Created: ${notification.createdAt}`);
      console.log('   ---');
    });

    process.exit(0);

  } catch (error) {
    console.error('Error finding notifications:', error);
    process.exit(1);
  }
}

findServiceUnavailableNotification();