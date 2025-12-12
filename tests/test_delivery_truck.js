// Test Delivery Truck Availability Logic
const mongoose = require('mongoose');
const Booking = require('./backend/models/Booking');
const Service = require('./backend/models/Service');
const User = require('./backend/models/User');
const { checkDeliveryTruckAvailability, requiresDeliveryTruck } = require('./backend/utils/deliveryService');

async function testDeliveryTruckLogic() {
  console.log('🧪 TESTING DELIVERY TRUCK AVAILABILITY LOGIC');
  console.log('=' .repeat(60));

  try {
    // Connect to database
    await mongoose.connect('mongodb://localhost:27017/trixtech');
    console.log('✅ Connected to database');

    // Clean up any existing test data
    await Booking.deleteMany({ notes: /TEST_DELIVERY/ });
    console.log('✅ Cleaned up test data');

    // Get test service that requires delivery
    const deliveryService = await Service.findOne({
      $or: [
        { category: { $in: ['equipment', 'furniture', 'lighting', 'sound-system', 'tents-canopies', 'linens-tableware'] } },
        { serviceType: { $in: ['equipment', 'supply'] } }
      ]
    });

    if (!deliveryService) {
      console.log('❌ No delivery-requiring service found. Creating test service...');

      // Create a test delivery service
      const testService = new Service({
        name: 'Test Delivery Equipment',
        description: 'Test equipment that requires delivery truck',
        category: 'equipment',
        serviceType: 'equipment',
        basePrice: 1000,
        quantity: 5,
        requiresDelivery: true
      });
      await testService.save();
      console.log('✅ Created test delivery service');
    }

    const service = deliveryService || await Service.findOne({ name: 'Test Delivery Equipment' });
    console.log(`📦 Using service: ${service.name} (requires delivery: ${requiresDeliveryTruck(service)})`);

    // Get test customer
    let customer = await User.findOne({ email: 'customer@trixtech.com' });
    if (!customer) {
      customer = new User({
        name: 'Test Customer',
        email: 'test@customer.com',
        password: 'password123',
        role: 'customer'
      });
      await customer.save();
      console.log('✅ Created test customer');
    }

    // Test 1: Check initial availability
    console.log('\n🧪 TEST 1: Initial Delivery Truck Availability');
    const testDate = new Date();
    testDate.setDate(testDate.getDate() + 1); // Tomorrow
    testDate.setHours(10, 0, 0, 0); // 10:00 AM

    const initialCheck = await checkDeliveryTruckAvailability(testDate, 60);
    console.log(`Initial availability at ${testDate.toLocaleString()}: ${initialCheck.available ? '✅ Available' : '❌ Not Available'}`);

    // Test 2: Create first booking
    console.log('\n🧪 TEST 2: Create First Delivery Booking');
    const booking1 = new Booking({
      customerId: customer._id,
      serviceId: service._id,
      quantity: 1,
      bookingDate: testDate,
      totalPrice: service.basePrice,
      basePrice: service.basePrice,
      status: 'confirmed',
      requiresDelivery: true,
      deliveryStartTime: testDate,
      deliveryEndTime: new Date(testDate.getTime() + 60 * 60 * 1000), // 1 hour
      deliveryDuration: 60,
      notes: 'TEST_DELIVERY_1'
    });
    await booking1.save();
    console.log(`✅ Created booking 1: ${testDate.toLocaleString()} - ${(new Date(testDate.getTime() + 60 * 60 * 1000)).toLocaleString()}`);

    // Test 3: Check availability during booked time
    console.log('\n🧪 TEST 3: Check Availability During Booked Time');
    const conflictCheck = await checkDeliveryTruckAvailability(testDate, 60);
    console.log(`Availability during booking: ${conflictCheck.available ? '❌ ERROR - Should not be available' : '✅ Correctly unavailable'}`);
    if (!conflictCheck.available) {
      console.log(`Reason: ${conflictCheck.reason}`);
    }

    // Test 4: Check availability 2 hours later (should be available after 1-hour buffer)
    console.log('\n🧪 TEST 4: Check Availability After Buffer Time');
    const afterBufferTime = new Date(testDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after start
    const afterBufferCheck = await checkDeliveryTruckAvailability(afterBufferTime, 60);
    console.log(`Availability 2 hours after booking start: ${afterBufferCheck.available ? '✅ Available (correct)' : '❌ Still unavailable (error)'}`);

    // Test 5: Check availability 30 minutes after booking end (should be unavailable due to 1-hour buffer)
    console.log('\n🧪 TEST 5: Check Availability Within Buffer Period');
    const withinBufferTime = new Date(testDate.getTime() + 90 * 60 * 1000); // 1.5 hours after start (30 min after end)
    const withinBufferCheck = await checkDeliveryTruckAvailability(withinBufferTime, 60);
    console.log(`Availability 30 min after booking end: ${withinBufferCheck.available ? '❌ ERROR - Should not be available' : '✅ Correctly unavailable'}`);

    // Test 6: Create second booking after buffer time
    console.log('\n🧪 TEST 6: Create Second Booking After Buffer');
    const booking2Time = new Date(testDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours after first booking
    const booking2 = new Booking({
      customerId: customer._id,
      serviceId: service._id,
      quantity: 1,
      bookingDate: booking2Time,
      totalPrice: service.basePrice,
      basePrice: service.basePrice,
      status: 'confirmed',
      requiresDelivery: true,
      deliveryStartTime: booking2Time,
      deliveryEndTime: new Date(booking2Time.getTime() + 60 * 60 * 1000), // 1 hour
      deliveryDuration: 60,
      notes: 'TEST_DELIVERY_2'
    });
    await booking2.save();
    console.log(`✅ Created booking 2: ${booking2Time.toLocaleString()} - ${(new Date(booking2Time.getTime() + 60 * 60 * 1000)).toLocaleString()}`);

    // Test 7: Verify both bookings exist and don't overlap
    console.log('\n🧪 TEST 7: Verify No Overlapping Bookings');
    const allBookings = await Booking.find({
      requiresDelivery: true,
      status: 'confirmed',
      notes: /TEST_DELIVERY/
    }).sort({ deliveryStartTime: 1 });

    console.log(`Found ${allBookings.length} delivery bookings:`);
    allBookings.forEach((booking, index) => {
      console.log(`${index + 1}. ${booking.deliveryStartTime.toLocaleString()} - ${booking.deliveryEndTime.toLocaleString()}`);
    });

    // Check for overlaps
    let hasOverlap = false;
    for (let i = 0; i < allBookings.length - 1; i++) {
      const current = allBookings[i];
      const next = allBookings[i + 1];

      // Add 1-hour buffer to current booking end time
      const currentEndWithBuffer = new Date(current.deliveryEndTime.getTime() + 60 * 60 * 1000);

      if (next.deliveryStartTime < currentEndWithBuffer) {
        console.log(`❌ OVERLAP DETECTED: Booking ${i + 2} starts before buffer time of booking ${i + 1}`);
        hasOverlap = true;
      }
    }

    if (!hasOverlap) {
      console.log('✅ No overlapping bookings detected');
    }

    // Cleanup
    await Booking.deleteMany({ notes: /TEST_DELIVERY/ });
    if (service.name === 'Test Delivery Equipment') {
      await Service.deleteOne({ _id: service._id });
    }
    console.log('\n🧹 Cleaned up test data');

    console.log('\n🎉 DELIVERY TRUCK AVAILABILITY TESTS COMPLETED');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testDeliveryTruckLogic();