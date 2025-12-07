const mongoose = require('mongoose');
const Notification = require('../models/Notification');

async function updateServiceUnavailableNotification() {
  try {
    console.log('Updating Service Unavailable notification...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Find and update the specific notification
    const result = await Notification.updateOne(
      {
        title: 'Service Unavailable',
        message: { $regex: 'Service not available in your area' }
      },
      {
        $set: {
          title: 'Service Unavailable',
          message: 'Service not available in your area. Distance: 37.1km'
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log(`✅ Updated ${result.modifiedCount} "Service Unavailable" notification`);
    } else {
      console.log('ℹ️ No "Service Unavailable" notification found with the exact text');
    }

    // Also check for any notifications containing "Service not available"
    const generalResult = await Notification.updateMany(
      {
        message: { $regex: 'Service not available', $options: 'i' }
      },
      [
        {
          $set: {
            message: {
              $replaceAll: {
                input: '$message',
                find: 'Service not available',
                replacement: 'Service not available'
              }
            }
          }
        }
      ]
    );

    console.log(`ℹ️ Checked ${generalResult.matchedCount} notifications with "Service not available"`);

    process.exit(0);

  } catch (error) {
    console.error('Error updating Service Unavailable notification:', error);
    process.exit(1);
  }
}

updateServiceUnavailableNotification();