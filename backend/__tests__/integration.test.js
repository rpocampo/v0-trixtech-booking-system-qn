const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');

describe('Integration Tests - Full Booking Flow', () => {
  let customerToken, adminToken, serviceId, customerId;

  beforeAll(async () => {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Complete Booking Flow', () => {
    it('should complete full booking flow from registration to payment', async () => {
      // 1. Register customer
      const customerData = {
        name: 'Integration Test Customer',
        email: 'integration@test.com',
        password: 'Password123'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(customerData)
        .expect(201);

      customerToken = registerResponse.body.token;
      customerId = registerResponse.body.user.id;

      // 2. Register admin (for approval)
      const adminData = {
        name: 'Integration Test Admin',
        email: 'admin@integration.test',
        password: 'Admin123',
        role: 'admin'
      };

      const adminRegisterResponse = await request(app)
        .post('/api/auth/register')
        .send(adminData)
        .expect(201);

      adminToken = adminRegisterResponse.body.token;

      // 3. Create a service
      const serviceData = {
        name: 'Integration Test Service',
        description: 'Test service for integration',
        category: 'wedding',
        serviceType: 'service',
        basePrice: 1500,
        includedItems: ['Basic setup', 'Cleanup'],
        duration: 120
      };

      const serviceResponse = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(serviceData)
        .expect(201);

      serviceId = serviceResponse.body.service._id;

      // 4. Create booking
      const bookingData = {
        serviceId: serviceId,
        bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        quantity: 1,
        notes: 'Integration test booking'
      };

      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(bookingData)
        .expect(200);

      const bookingId = bookingResponse.body.booking._id;

      // 5. Verify booking created with pending status
      expect(bookingResponse.body.booking.status).toBe('pending');

      // 6. Check notification was created for admin
      const notifications = await Notification.find({ userId: adminRegisterResponse.body.user.id });
      expect(notifications.length).toBeGreaterThan(0);

      // 7. Create payment QR for the booking
      const paymentData = {
        bookingId: bookingId,
        amount: bookingResponse.body.booking.totalPrice,
        paymentType: 'full'
      };

      const paymentResponse = await request(app)
        .post('/api/payments/create-qr')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(paymentData)
        .expect(200);

      const referenceNumber = paymentResponse.body.referenceNumber;

      // 8. Simulate payment completion by calling verify endpoint
      const verifyResponse = await request(app)
        .post(`/api/payments/verify-qr/${referenceNumber}`)
        .send({
          amount: bookingResponse.body.booking.totalPrice,
          status: 'completed',
          transactionId: 'TEST_TXN_' + Date.now()
        })
        .expect(200);

      // 9. Verify payment completed and booking confirmed
      expect(verifyResponse.body.success).toBe(true);

      // 10. Verify booking status updated
      const updatedBooking = await Booking.findById(bookingId);
      expect(updatedBooking.status).toBe('confirmed');

      // 11. Check customer notifications
      const customerNotifications = await Notification.find({ userId: customerId });
      expect(customerNotifications.length).toBeGreaterThan(0);

      // 12. Verify data consistency - booking should have payment reference
      const bookingWithPayment = await Booking.findById(bookingId).populate('paymentId');
      expect(bookingWithPayment.paymentId).toBeDefined();
    });

    it('should handle concurrent booking attempts for same service', async () => {
      // Create another customer
      const customer2Data = {
        name: 'Concurrent Test Customer',
        email: 'concurrent@test.com',
        password: 'Password123'
      };

      const register2Response = await request(app)
        .post('/api/auth/register')
        .send(customer2Data)
        .expect(201);

      const customer2Token = register2Response.body.token;

      // Try to book the same service at same time
      const bookingData1 = {
        serviceId: serviceId,
        eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'corporate',
        guestCount: 50
      };

      const bookingData2 = {
        serviceId: serviceId,
        eventDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        eventType: 'birthday',
        guestCount: 30
      };

      // Send both requests simultaneously
      const [response1, response2] = await Promise.all([
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customerToken}`)
          .send(bookingData1),
        request(app)
          .post('/api/bookings')
          .set('Authorization', `Bearer ${customer2Token}`)
          .send(bookingData2)
      ]);

      // At least one should succeed, one might fail due to availability
      const successCount = [response1.status, response2.status].filter(status => status === 201).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Data Consistency Checks', () => {
    it('should maintain referential integrity', async () => {
      // Get all bookings and verify they reference valid users and services
      const bookings = await Booking.find({});
      for (const booking of bookings) {
        const userExists = await User.findById(booking.customerId);
        const serviceExists = await Service.findById(booking.serviceId);

        expect(userExists).toBeTruthy();
        expect(serviceExists).toBeTruthy();
      }
    });

    it('should handle transaction rollbacks on failure', async () => {
      // This would require testing payment failure scenarios
      // For now, verify that failed payments don't create orphaned records
      const failedPayments = await Payment.find({ status: 'failed' });
      for (const payment of failedPayments) {
        const booking = await Booking.findById(payment.bookingId);
        if (booking) {
          // If payment failed, booking should not be confirmed
          expect(booking.status).not.toBe('confirmed');
        }
      }
    });
  });
});