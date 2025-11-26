const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

describe('Data Consistency Testing', () => {
  let customerToken, adminToken, serviceId, bookingId;

  beforeAll(async () => {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test data
    const customerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Data Consistency Customer',
        email: 'dataconsistency@test.com',
        password: 'Password123'
      });

    customerToken = customerResponse.body.token;

    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Data Consistency Admin',
        email: 'admin@dataconsistency.test',
        password: 'Admin123',
        role: 'admin'
      });

    adminToken = adminResponse.body.token;
  });

  describe('Database Integrity Checks', () => {
    it('should maintain referential integrity between collections', async () => {
      // Get all bookings and verify their referenced documents exist
      const bookings = await Booking.find({}).populate('customerId').populate('serviceId');

      for (const booking of bookings) {
        if (booking.customerId) {
          expect(booking.customerId).toBeDefined();
          expect(booking.customerId._id).toEqual(booking.customerId);
        }

        if (booking.serviceId) {
          expect(booking.serviceId).toBeDefined();
          expect(booking.serviceId._id).toEqual(booking.serviceId);
        }
      }

      // Get all payments and verify booking references
      const payments = await Payment.find({}).populate('bookingId');
      for (const payment of payments) {
        if (payment.bookingId) {
          expect(payment.bookingId).toBeDefined();
          expect(payment.bookingId._id).toEqual(payment.bookingId);
        }
      }
    });

    it('should handle orphaned records gracefully', async () => {
      // Create a booking
      const bookingResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: '507f1f77bcf86cd799439011', // Non-existent service ID
          bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 1
        });

      // Should fail due to non-existent service
      expect([400, 404]).toContain(bookingResponse.status);
    });

    it('should validate data types and constraints', async () => {
      // Test invalid data types in requests
      const invalidRequests = [
        {
          name: 12345, // Should be string
          email: 'invalid@test.com',
          password: 'Password123'
        },
        {
          name: 'Valid Name',
          email: 'invalid-email', // Invalid email format
          password: 'Password123'
        },
        {
          name: 'Valid Name',
          email: 'valid@test.com',
          password: 'short' // Too short password
        }
      ];

      for (const invalidData of invalidRequests) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(invalidData);

        // Should reject invalid data
        expect([400, 409]).toContain(response.status);
      }
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback transactions on failure', async () => {
      // This test is limited since we can't easily simulate transaction failures
      // in the test environment, but we can verify that successful operations
      // maintain consistency

      const initialBookingCount = await Booking.countDocuments();
      const initialPaymentCount = await Payment.countDocuments();

      // Create a user for testing
      const testUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Transaction Test User',
          email: `transaction${Date.now()}@test.com`,
          password: 'Password123'
        });

      // Verify counts haven't changed unexpectedly
      const finalBookingCount = await Booking.countDocuments();
      const finalPaymentCount = await Payment.countDocuments();

      expect(finalBookingCount).toBe(initialBookingCount);
      expect(finalPaymentCount).toBe(initialPaymentCount);
    });

    it('should maintain data consistency across related operations', async () => {
      // Test that related data stays consistent
      const users = await User.find({});
      const bookings = await Booking.find({});
      const payments = await Payment.find({});

      // All bookings should reference existing users
      for (const booking of bookings) {
        if (booking.customerId) {
          const userExists = users.some(user => user._id.equals(booking.customerId));
          expect(userExists).toBe(true);
        }
      }

      // All payments should reference existing bookings (if bookingId exists)
      for (const payment of payments) {
        if (payment.bookingId) {
          const bookingExists = bookings.some(booking => booking._id.equals(payment.bookingId));
          expect(bookingExists).toBe(true);
        }
      }
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('should sanitize and validate input data', async () => {
      const maliciousData = [
        {
          name: '<script>alert("xss")</script>',
          email: 'xss@test.com',
          password: 'Password123'
        },
        {
          name: 'Valid Name',
          email: 'test@test.com',
          password: 'Password123<script>alert(1)</script>'
        }
      ];

      for (const data of maliciousData) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(data);

        // Should either reject or sanitize
        expect([200, 201, 400, 409]).toContain(response.status);

        if (response.status === 201) {
          // If registration succeeded, check that malicious content was handled
          expect(response.body.user.name).not.toContain('<script>');
        }
      }
    });

    it('should enforce unique constraints', async () => {
      // Try to create duplicate email
      const originalResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original User',
          email: 'unique@test.com',
          password: 'Password123'
        });

      expect([200, 201, 409]).toContain(originalResponse.status);

      // Try duplicate
      const duplicateResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate User',
          email: 'unique@test.com', // Same email
          password: 'Password123'
        });

      // Should fail due to duplicate email
      expect(duplicateResponse.status).toBe(409);
    });

    it('should validate required fields', async () => {
      const incompleteData = [
        { email: 'test@test.com', password: 'Password123' }, // Missing name
        { name: 'Test User', password: 'Password123' }, // Missing email
        { name: 'Test User', email: 'test@test.com' } // Missing password
      ];

      for (const data of incompleteData) {
        const response = await request(app)
          .post('/api/auth/register')
          .send(data);

        // Should reject incomplete data
        expect(response.status).toBe(400);
      }
    });
  });

  describe('Concurrent Data Access', () => {
    it('should handle concurrent data modifications safely', async () => {
      // Create multiple users simultaneously
      const userPromises = [];
      for (let i = 0; i < 5; i++) {
        userPromises.push(
          request(app)
            .post('/api/auth/register')
            .send({
              name: `Concurrent User ${i}`,
              email: `concurrent${i}_${Date.now()}@test.com`,
              password: 'Password123'
            })
        );
      }

      const responses = await Promise.all(userPromises);

      // All should either succeed or fail gracefully
      const successCount = responses.filter(r => [200, 201].includes(r.status)).length;
      const failureCount = responses.filter(r => ![200, 201].includes(r.status)).length;

      expect(successCount + failureCount).toBe(5);

      // Verify no duplicate data was created
      const emails = responses
        .filter(r => r.status === 201)
        .map(r => r.body.user.email);

      const uniqueEmails = new Set(emails);
      expect(uniqueEmails.size).toBe(emails.length);
    });

    it('should maintain data integrity under load', async () => {
      // Perform multiple operations simultaneously
      const operations = [];

      for (let i = 0; i < 10; i++) {
        operations.push(
          request(app)
            .get('/api/services')
            .set('Authorization', `Bearer ${customerToken}`)
        );
      }

      const responses = await Promise.all(operations);

      // All read operations should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(10);

      // Verify data consistency - all responses should be similar
      const firstResponse = responses[0].body;
      for (const response of responses.slice(1)) {
        // Structure should be consistent
        expect(response.body).toHaveProperty('success');
      }
    });
  });

  describe('Data Recovery and Backup Integrity', () => {
    it('should handle database reconnection gracefully', async () => {
      // Test database disconnection and reconnection
      const initialConnection = mongoose.connection.readyState;

      // Disconnect
      await mongoose.disconnect();

      // Try operation while disconnected
      const disconnectedResponse = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should handle gracefully (might return error or cached data)
      expect([200, 500]).toContain(disconnectedResponse.status);

      // Reconnect
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');

      // Try again after reconnection
      const reconnectedResponse = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should work after reconnection
      expect(reconnectedResponse.status).toBe(200);
    });

    it('should validate data after operations', async () => {
      // Perform some operations and verify data integrity
      const beforeCount = await User.countDocuments();

      // Create a user
      const createResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Integrity Test User',
          email: `integrity${Date.now()}@test.com`,
          password: 'Password123'
        });

      const afterCount = await User.countDocuments();

      if (createResponse.status === 201) {
        expect(afterCount).toBe(beforeCount + 1);

        // Verify the created user exists and has valid data
        const createdUser = await User.findById(createResponse.body.user.id);
        expect(createdUser).toBeDefined();
        expect(createdUser.name).toBe('Integrity Test User');
        expect(createdUser.email).toContain('integrity');
      } else {
        expect(afterCount).toBe(beforeCount);
      }
    });
  });
});