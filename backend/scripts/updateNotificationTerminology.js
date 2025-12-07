const mongoose = require('mongoose');
const Notification = require('../models/Notification');

async function updateNotificationTerminology() {
  try {
    console.log('Starting notification terminology update...');

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Update titles
    const titleUpdates = await Notification.updateMany(
      { title: { $regex: /\bBooking\b/, $options: 'i' } },
      [
        {
          $set: {
            title: {
              $replaceAll: {
                input: '$title',
                find: 'Booking',
                replacement: 'Reservation'
              }
            }
          }
        }
      ]
    );

    console.log(`Updated ${titleUpdates.modifiedCount} notification titles`);

    // Update messages
    const messageUpdates = await Notification.updateMany(
      { message: { $regex: /\b(booking|booked)\b/, $options: 'i' } },
      [
        {
          $set: {
            message: {
              $replaceAll: {
                input: {
                  $replaceAll: {
                    input: '$message',
                    find: 'booking',
                    replacement: 'reservation'
                  }
                },
                find: 'booked',
                replacement: 'reserved'
              }
            }
          }
        }
      ]
    );

    console.log(`Updated ${messageUpdates.modifiedCount} notification messages`);

    // Update specific patterns
    const specificUpdates = await Notification.updateMany(
      { message: { $regex: /\bBooking\b/, $options: 'i' } },
      [
        {
          $set: {
            message: {
              $replaceAll: {
                input: '$message',
                find: 'Booking',
                replacement: 'Reservation'
              }
            }
          }
        }
      ]
    );

    console.log(`Updated ${specificUpdates.modifiedCount} notification messages with capitalized Booking`);

    console.log('Notification terminology update completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error updating notification terminology:', error);
    process.exit(1);
  }
}

updateNotificationTerminology();