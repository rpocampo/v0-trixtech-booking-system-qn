const mongoose = require('mongoose');
const User = require('./models/User');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const { sendTemplateNotification } = require('./utils/notificationService');

async function testAdminNotification() {
  console.log('🧪 Testing Admin Notification System');
  console.log('=' .repeat(50));

  try {
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/trixtech');
    console.log('✅ Database connected');

    // Find admin user
    const adminUsers = await User.find({ role: 'admin' });
    console.log(`✅ Found ${adminUsers.length} admin users`);

    if (adminUsers.length === 0) {
      console.log('❌ No admin users found');
      return;
    }

    // Find a service
    const service = await Service.findOne();
    if (!service) {
      console.log('❌ No services found');
      return;
    }
    console.log(`✅ Found service: ${service.name}`);

    // Find a customer
    const customer = await User.findOne({ role: 'customer' });
    if (!customer) {
      console.log('❌ No customer users found');
      return;
    }
    console.log(`✅ Found customer: ${customer.name}`);

    // Send test admin notification
    console.log('📤 Sending test admin notification...');
    const notification = await sendTemplateNotification(adminUsers[0]._id, 'NEW_PENDING_BOOKING_ADMIN', {
      message: `Test: New pending booking received from customer for ${service.name}.`,
      metadata: {
        bookingId: 'test_booking_id',
        serviceId: service._id,
        amount: 1000,
      },
    });

    console.log('✅ Admin notification sent successfully');
    console.log('📋 Notification details:', {
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority
    });

  } catch (error) {
    console.error('❌ Error testing admin notification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Database disconnected');
  }
}

testAdminNotification();