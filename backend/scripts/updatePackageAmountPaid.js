const mongoose = require('mongoose');
const Booking = require('../models/Booking');

async function updatePackageAmountPaid() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find all package bookings that are paid but have amountPaid as 0
    const packageBookings = await Booking.find({
      isPackageBooking: true,
      paymentStatus: 'paid',
      amountPaid: { $in: [0, null, undefined] }
    });

    console.log(`Found ${packageBookings.length} package bookings to update`);

    let updatedCount = 0;

    for (const booking of packageBookings) {
      // Update amountPaid to match totalPrice for paid package bookings
      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            amountPaid: booking.totalPrice,
            remainingBalance: 0
          }
        }
      );

      updatedCount++;
      console.log(`Updated booking ${booking._id}: amountPaid set to ₱${booking.totalPrice}`);
    }

    console.log(`Successfully updated ${updatedCount} package bookings`);

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error updating package bookings:', error);
    process.exit(1);
  }
}

// Run the update
updatePackageAmountPaid();