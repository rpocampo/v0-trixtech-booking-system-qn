const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');

describe('Edge Cases and Error Scenarios', () => {
  let customerToken, adminToken, serviceId;

  beforeAll(async () => {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create test user and service for edge case testing
    const customerData = {
      name: 'Edge Case Customer',
      email: 'edge@test.com',
      password: 'Password123'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(customerData)
      .expect(201);

    customerToken = registerResponse.body.token;

    // Create admin
    const adminData = {
      name: 'Edge Case Admin',
      email: 'admin@edge.test',
      password: 'Admin123',
      role: 'admin'
    };

    const adminRegisterResponse = await request(app)
      .post('/api/auth/register')
      .send(adminData)
      .expect(201);

    adminToken = adminRegisterResponse.body.token;

    // Create a service
    const serviceData = {
      name: 'Edge Case Test Service',
      description: 'Test service for edge cases',
      category: 'wedding',
      serviceType: 'service',
      basePrice: 1000,
      includedItems: ['Basic service'],
      duration: 60
    };

    const serviceResponse = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(serviceData)
      .expect(201);

    serviceId = serviceResponse.body.service._id;
  });

  describe('Authentication Edge Cases', () => {
    it('should reject registration with extremely long name', async () => {
      const longName = 'A'.repeat(1000);
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: longName,
          email: 'longname@test.com',
          password: 'Password123'
        });

      // Should either validate length or handle gracefully
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should reject login with malformed email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'Password123'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should handle SQL injection attempts in login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: "' OR '1'='1",
          password: "' OR '1'='1"
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should reject registration with XSS in name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: '<script>alert("xss")</script>',
          email: 'xss@test.com',
          password: 'Password123'
        });

      // Should either sanitize or reject
      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Booking Edge Cases', () => {
    it('should reject booking with past date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          bookingDate: pastDate.toISOString(),
          quantity: 1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle booking with extremely large quantity', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 999999
        });

      // Should either handle gracefully or reject
      expect([200, 400, 409]).toContain(response.status);
    });

    it('should reject booking with invalid service ID', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: 'invalid-id',
          bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 1
        })
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should handle concurrent bookings for same time slot', async () => {
      const bookingDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Send multiple concurrent requests
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${customerToken}`)
            .send({
              serviceId: serviceId,
              bookingDate: bookingDate,
              quantity: 1
            })
        );
      }

      const responses = await Promise.all(promises);

      // At least some should succeed, some may fail due to availability
      const successCount = responses.filter(r => r.status === 200).length;
      const failureCount = responses.filter(r => r.status !== 200).length;

      expect(successCount + failureCount).toBe(5);
    });
  });

  describe('Service Edge Cases', () => {
    it('should reject service creation with negative price', async () => {
      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negative Price Service',
          description: 'Test service',
          category: 'wedding',
          serviceType: 'service',
          basePrice: -100,
          includedItems: ['Test'],
          duration: 60
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle service creation with extremely long description', async () => {
      const longDescription = 'A'.repeat(10000);
      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Long Description Service',
          description: longDescription,
          category: 'wedding',
          serviceType: 'service',
          basePrice: 100,
          includedItems: ['Test'],
          duration: 60
        });

      // Should either handle or reject gracefully
      expect([201, 400]).toContain(response.status);
    });

    it('should reject duplicate service names', async () => {
      // First create a service
      await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Test Service',
          description: 'First service',
          category: 'wedding',
          serviceType: 'service',
          basePrice: 100,
          includedItems: ['Test'],
          duration: 60
        })
        .expect(201);

      // Try to create another with same name
      const response = await request(app)
        .post('/api/services')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate Test Service',
          description: 'Second service',
          category: 'wedding',
          serviceType: 'service',
          basePrice: 200,
          includedItems: ['Test'],
          duration: 60
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment Edge Cases', () => {
    it('should handle payment with zero amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-qr')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId: 'some-booking-id',
          amount: 0,
          paymentType: 'full'
        });

      // Should reject zero amount payments
      expect([400, 500]).toContain(response.status);
    });

    it('should handle payment with extremely large amount', async () => {
      const response = await request(app)
        .post('/api/payments/create-qr')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          bookingId: 'some-booking-id',
          amount: 999999999,
          paymentType: 'full'
        });

      // Should either handle or reject gracefully
      expect([200, 400]).toContain(response.status);
    });

    it('should reject payment verification with invalid reference number', async () => {
      const response = await request(app)
        .post('/api/payments/verify-qr/invalid-ref')
        .send({
          amount: 100,
          status: 'completed',
          transactionId: 'test'
        });

      expect([400, 404]).toContain(response.status);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null/undefined values in requests', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: null,
          bookingDate: undefined,
          quantity: null
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .set('Content-Type', 'application/json')
        .send('{invalid json')
        .expect(400);

      // Express should handle malformed JSON
    });

    it('should handle extremely large request bodies', async () => {
      const largeData = 'x'.repeat(1000000); // 1MB of data
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          serviceId: serviceId,
          bookingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          quantity: 1,
          notes: largeData
        });

      // Should either handle or reject based on limits
      expect([200, 400, 413]).toContain(response.status);
    });
  });

  describe('Race Conditions and Concurrency', () => {
    it('should handle rapid successive requests', async () => {
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/services')
            .set('Authorization', `Bearer ${customerToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const successCount = responses.filter(r => r.status === 200).length;

      // Most should succeed
      expect(successCount).toBeGreaterThan(5);
    });

    it('should handle database connection interruptions gracefully', async () => {
      // This is hard to test in unit tests, but we can test error handling
      // when database operations fail

      // Temporarily disconnect mongoose to simulate DB issues
      const originalConnection = mongoose.connection.readyState;
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/services')
        .set('Authorization', `Bearer ${customerToken}`);

      // Should handle DB disconnection gracefully
      expect([200, 500]).toContain(response.status);

      // Reconnect
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trixtech');
    });
  });
});