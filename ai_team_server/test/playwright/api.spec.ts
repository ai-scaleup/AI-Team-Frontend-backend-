import { test, expect } from '@playwright/test';

test.describe('Backend API', () => {
  test('should return 200 for health check or root endpoint', async ({
    request,
  }) => {
    const response = await request.get('/');
    // Check if the status is 200. If 404/others, we adjust based on actual endpoints.
    // Based on app.controller.ts, there might be a hello world.
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('Hello World!');
  });
});
