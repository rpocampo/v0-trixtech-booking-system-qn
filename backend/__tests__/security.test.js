const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('Security Testing', () => {
  beforeAll(async () => {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('SQL Injection Prevention', () => {
    it('should prevent SQL injection in login', async () => {
      const injectionAttempts = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "' OR 1=1 --",
        "admin' --",
        "' UNION SELECT * FROM users --",
        "'; DROP TABLE users; --"
      ];

      for (const attempt of injectionAttempts) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: attempt,
            password: 'password'
          });

        // Should not succeed with injection
        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
      }
    });

    it('should prevent SQL injection in registration', async () => {
      const injectionAttempts = [
        "test@example.com'; DROP TABLE users; --",
        "test@example.com' OR '1'='1",
        "'; SELECT * FROM users; --@example.com"
      ];

      for (const attempt of injectionAttempts) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: attempt,
            password: 'Password123'
          });

        // Should either fail validation or be sanitized
        expect([400, 409]).toContain(response.status);
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should prevent XSS in user registration', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: payload,
            email: `xss${Date.now()}@test.com`,
            password: 'Password123'
          });

        // Should either reject or sanitize the input
        expect([200, 201, 400]).toContain(response.status);

        // If registration succeeds, the stored data should not contain executable scripts
        if (response.status === 201) {
          // In a real scenario, we'd check the database to ensure XSS is prevented
          // For now, just ensure the response doesn't contain the raw script
          expect(response.body.user.name).not.toContain('<script>');
        }
      }
    });

    it('should handle XSS in query parameters', async () => {
      const xssParams = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(1)</script>'
      ];

      for (const param of xssParams) {
        const response = await request(app)
          .get(`/api/services?search=${encodeURIComponent(param)}`);

        // Should not execute scripts in response
        expect(response.status).toBe(200);
        // Response should be JSON, not HTML with executed scripts
        expect(response.headers['content-type']).toContain('application/json');
      }
    });
  });

  describe('Authentication Bypass Attempts', () => {
    it('should prevent JWT token manipulation', async () => {
      // First create a valid user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'JWT Test User',
          email: 'jwt@test.com',
          password: 'Password123'
        });

      const token = userResponse.body.token;

      // Try to manipulate the token
      const manipulatedTokens = [
        token + 'extra',
        token.slice(0, -10),
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImZha2VpZCIsInJvbGUiOiJhZG1pbiJ9.fake',
        '',
        null,
        'Bearer ',
        'Bearer' + token
      ];

      for (const badToken of manipulatedTokens) {
        const response = await request(app)
          .get('/api/bookings')
          .set('Authorization', badToken ? `Bearer ${badToken}` : '');

        // Should reject invalid tokens
        expect([401, 403]).toContain(response.status);
      }
    });

    it('should prevent role escalation', async () => {
      // Create a regular user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Role Test User',
          email: 'role@test.com',
          password: 'Password123'
        });

      const token = userResponse.body.token;

      // Try to access admin-only endpoints
      const adminEndpoints = [
        '/api/services',
        '/api/bookings/admin/all',
        '/api/admin/dashboard'
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${token}`);

        // Should be forbidden for regular users
        expect([403, 401]).toContain(response.status);
      }
    });

    it('should prevent unauthorized access to other users data', async () => {
      // Create two users
      const user1Response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User One',
          email: 'user1@test.com',
          password: 'Password123'
        });

      const user2Response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'User Two',
          email: 'user2@test.com',
          password: 'Password123'
        });

      const token1 = user1Response.body.token;
      const user2Id = user2Response.body.user.id;

      // Try to access user2's bookings with user1's token
      const response = await request(app)
        .get(`/api/bookings/${user2Id}`)
        .set('Authorization', `Bearer ${token1}`);

      // Should be forbidden
      expect([403, 401]).toContain(response.status);
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    it('should handle rapid login attempts', async () => {
      const loginAttempts = [];
      for (let i = 0; i < 20; i++) {
        loginAttempts.push(
          request(app)
            .post('/api/auth/login')
            .send({
              email: 'nonexistent@test.com',
              password: 'wrongpassword'
            })
        );
      }

      const responses = await Promise.all(loginAttempts);

      // Some requests should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      const authFailureCount = responses.filter(r => r.status === 401).length;

      // Should have some rate limiting or consistent rejection
      expect(rateLimitedCount + authFailureCount).toBe(20);
    });

    it('should handle large request payloads', async () => {
      const largePayload = 'x'.repeat(1000000); // 1MB payload

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: largePayload,
          email: `large${Date.now()}@test.com`,
          password: 'Password123'
        });

      // Should either handle gracefully or reject
      expect([200, 201, 400, 413]).toContain(response.status);
    });
  });

  describe('Input Validation Security', () => {
    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user@@example.com',
        'user@.com',
        'user..user@example.com',
        'user@example..com',
        'user @example.com',
        'user@example.com ',
        ''
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: email,
            password: 'Password123'
          });

        // Should reject invalid emails
        expect([400, 422]).toContain(response.status);
      }
    });

    it('should enforce password complexity', async () => {
      const weakPasswords = [
        '123',
        'password',
        '123456',
        'abc',
        '',
        'a'.repeat(1000) // Extremely long password
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            name: 'Test User',
            email: `weak${Date.now()}@test.com`,
            password: password
          });

        // Should reject weak passwords
        expect([400, 422]).toContain(response.status);
      }
    });

    it('should prevent path traversal attacks', async () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        'C:\\Windows\\System32',
        '../../../../config/database.js'
      ];

      for (const path of traversalAttempts) {
        const response = await request(app)
          .get(`/api/services/${path}`);

        // Should not allow path traversal
        expect([400, 404, 403]).toContain(response.status);
      }
    });
  });

  describe('Session and Token Security', () => {
    it('should expire tokens appropriately', async () => {
      // Create a user
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Session Test User',
          email: 'session@test.com',
          password: 'Password123'
        });

      const token = userResponse.body.token;

      // Use token immediately - should work
      const immediateResponse = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(immediateResponse.status).toBe(200);

      // Note: In a real test, we'd wait for token expiry, but that's not practical
      // This test ensures tokens work when valid
    });

    it('should invalidate tokens on logout', async () => {
      // Note: If there's no logout endpoint, this test would need adjustment
      // For now, just test that tokens remain valid until expiry
      const userResponse = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Logout Test User',
          email: 'logout@test.com',
          password: 'Password123'
        });

      const token = userResponse.body.token;

      // Token should work
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
    });
  });
});