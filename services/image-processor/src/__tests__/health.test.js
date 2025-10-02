process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const request = require('supertest');

describe('Health endpoint', () => {
  it('returns healthy status', async () => {
    // Import without starting the HTTP listener
    const { app } = require('../server');
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'image-processor');
  });
});
