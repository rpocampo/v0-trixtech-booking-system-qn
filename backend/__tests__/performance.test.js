const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('Performance Testing', () => {
  let customerToken;

  beforeAll(async () => {
    // Wait for database connection
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Create a test user for performance testing
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Performance Test User',
        email: 'perf@test.com',
        password: 'Password123'
      });

    customerToken = userResponse.body.token;
  });

  describe('Concurrent User Load Testing', () => {
    it('should handle 10 concurrent users making requests', async () => {
      const startTime = Date.now();
      const requests = [];

      // Create 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get('/api/services')
            .set('Authorization', `Bearer ${customerToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / responses.length;

      console.log(`Concurrent load test (10 users):`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Average response time: ${avgResponseTime}ms`);

      // All requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(10);

      // Average response time should be reasonable (< 1000ms)
      expect(avgResponseTime).toBeLessThan(1000);
    });

    it('should handle 20 rapid successive requests', async () => {
      const startTime = Date.now();
      const requests = [];

      // Create 20 rapid requests
      for (let i = 0; i < 20; i++) {
        requests.push(
          request(app)
            .get('/api/bookings')
            .set('Authorization', `Bearer ${customerToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgResponseTime = totalTime / responses.length;

      console.log(`Rapid requests test (20 requests):`);
      console.log(`Total time: ${totalTime}ms`);
      console.log(`Average response time: ${avgResponseTime}ms`);

      // Most requests should succeed (some may be rate limited)
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(10);

      // Average response time should be reasonable
      expect(avgResponseTime).toBeLessThan(2000);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const startTime = Date.now();

      // Test with various query parameters that might return large datasets
      const response = await request(app)
        .get('/api/services?limit=100')
        .set('Authorization', `Bearer ${customerToken}`);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Large dataset test:`);
      console.log(`Response time: ${responseTime}ms`);
      console.log(`Status: ${response.status}`);

      // Should complete within reasonable time
      expect(responseTime).toBeLessThan(5000);
      expect([200, 404]).toContain(response.status); // 404 if no services exist
    });

    it('should handle complex search queries', async () => {
      const searchTerms = ['wedding', 'party', 'corporate', 'birthday'];

      for (const term of searchTerms) {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/services?search=${encodeURIComponent(term)}`)
          .set('Authorization', `Bearer ${customerToken}`);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Search performance for "${term}": ${responseTime}ms`);

        // Search should be fast
        expect(responseTime).toBeLessThan(1000);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Memory Usage and Resource Testing', () => {
    it('should handle memory-intensive operations', async () => {
      // Test with large payloads
      const largeData = 'x'.repeat(100000); // 100KB of data

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Memory Test User',
          email: `memory${Date.now()}@test.com`,
          password: 'Password123',
          notes: largeData // Large field
        });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      console.log(`Memory-intensive operation: ${responseTime}ms`);

      // Should handle without excessive delay
      expect(responseTime).toBeLessThan(3000);
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 5;
      const responseTimes = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();

        await request(app)
          .get('/api/services')
          .set('Authorization', `Bearer ${customerToken}`);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);

      console.log(`Sustained load performance (${iterations} requests):`);
      console.log(`Average: ${avgResponseTime}ms`);
      console.log(`Max: ${maxResponseTime}ms`);
      console.log(`Min: ${minResponseTime}ms`);

      // Performance should not degrade significantly
      expect(avgResponseTime).toBeLessThan(1000);
      expect(maxResponseTime).toBeLessThan(2000);
    });
  });

  describe('Database Query Performance', () => {
    it('should handle database queries efficiently', async () => {
      const startTime = Date.now();

      // Test multiple database operations
      const operations = [
        request(app).get('/api/services').set('Authorization', `Bearer ${customerToken}`),
        request(app).get('/api/bookings').set('Authorization', `Bearer ${customerToken}`),
        request(app).get('/api/services?category=wedding').set('Authorization', `Bearer ${customerToken}`)
      ];

      const responses = await Promise.all(operations);
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const avgTime = totalTime / operations.length;

      console.log(`Database query performance:`);
      console.log(`Total time for ${operations.length} queries: ${totalTime}ms`);
      console.log(`Average time per query: ${avgTime}ms`);

      // All should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBe(operations.length);

      // Should be reasonably fast
      expect(avgTime).toBeLessThan(1000);
    });

    it('should handle sorting and filtering efficiently', async () => {
      const sortOptions = ['name', 'price', 'category'];
      const filterOptions = ['wedding', 'party', 'corporate'];

      for (const sortBy of sortOptions) {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/services?sortBy=${sortBy}&sortOrder=asc`)
          .set('Authorization', `Bearer ${customerToken}`);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Sort by ${sortBy}: ${responseTime}ms`);

        expect(responseTime).toBeLessThan(1000);
        expect(response.status).toBe(200);
      }

      for (const category of filterOptions) {
        const startTime = Date.now();

        const response = await request(app)
          .get(`/api/services?category=${category}`)
          .set('Authorization', `Bearer ${customerToken}`);

        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Filter by ${category}: ${responseTime}ms`);

        expect(responseTime).toBeLessThan(1000);
        expect([200, 404]).toContain(response.status);
      }
    });
  });

  describe('API Endpoint Performance', () => {
    const endpoints = [
      { path: '/api/services', method: 'GET' },
      { path: '/api/bookings', method: 'GET' },
      { path: '/api/auth/login', method: 'POST', body: { email: 'perf@test.com', password: 'Password123' } }
    ];

    it('should benchmark key API endpoints', async () => {
      const results = {};

      for (const endpoint of endpoints) {
        const times = [];

        // Test each endpoint 3 times
        for (let i = 0; i < 3; i++) {
          const startTime = Date.now();

          let req = request(app);
          if (endpoint.method === 'GET') {
            req = req.get(endpoint.path);
            if (endpoint.path !== '/api/auth/login') {
              req = req.set('Authorization', `Bearer ${customerToken}`);
            }
          } else if (endpoint.method === 'POST') {
            req = req.post(endpoint.path).send(endpoint.body);
          }

          await req;
          const endTime = Date.now();
          times.push(endTime - startTime);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        results[endpoint.path] = {
          average: avgTime,
          min: Math.min(...times),
          max: Math.max(...times)
        };

        console.log(`Endpoint ${endpoint.path}:`);
        console.log(`  Average: ${avgTime}ms`);
        console.log(`  Min: ${Math.min(...times)}ms`);
        console.log(`  Max: ${Math.max(...times)}ms`);
      }

      // All endpoints should perform reasonably well
      for (const [path, metrics] of Object.entries(results)) {
        expect(metrics.average).toBeLessThan(2000);
      }
    });
  });
});