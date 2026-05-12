import { test, expect } from '@playwright/test';

test.describe('User and Conversation Flow', () => {
  // Generate unique identifiers for this test run
  const uniqueId = Date.now().toString();
  const oauthId = `test-user-${uniqueId}`;
  const email = `test-${uniqueId}@example.com`;
  const username = `TestUser${uniqueId}`;
  const agentId = 'test-agent-1'; // Assuming this doesn't need to exist in DB for now, or we might need a real one
  const sessionId = `session-${uniqueId}`;

  let userId: string;
  let conversationId: string;
  let messageId: string;

  test.beforeAll(async ({ request }) => {
    // Ensure clean state if needed, but we use unique IDs
  });

  test('1. Create a new user', async ({ request }) => {
    const response = await request.post('/users', {
      data: {
        email,
        oauthId,
        username,
      },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.email).toBe(email);
    expect(body.id).toBeDefined();
    userId = body.id;
  });

  test('2. Get user by ID', async ({ request }) => {
    expect(userId).toBeDefined();
    const response = await request.get(`/users/${userId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(userId);
    expect(body.username).toBe(username);
  });

  test('3. Update user username', async ({ request }) => {
    const newUsername = `${username}-updated`;
    const response = await request.patch(`/users/${userId}`, {
      data: {
        username: newUsername,
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.username).toBe(newUsername);
  });

  test('4. Create a conversation', async ({ request }) => {
    const convId = `chat_${uniqueId}`;
    const response = await request.post(`/conversations/${oauthId}`, {
      data: {
        id: convId,
        title: 'Test Conversation',
        agentId: agentId,
        sessionId: sessionId,
        messages: [],
      },
    });
    // Start by checking if 201 or 200 (if it returns existing)
    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.id).toBe(convId);
    conversationId = body.id;
  });

  test('5. Get all conversations for user', async ({ request }) => {
    const response = await request.get(`/conversations/${oauthId}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
    const found = body.find((c: any) => c.id === conversationId);
    expect(found).toBeDefined();
  });

  test('6. Get single conversation', async ({ request }) => {
    const response = await request.get(
      `/conversations/${oauthId}/${conversationId}`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(conversationId);
  });

  test('7. Add a message to conversation', async ({ request }) => {
    const response = await request.post(
      `/conversations/${oauthId}/${conversationId}/messages`,
      {
        data: {
          text: 'Hello, AI!',
          sender: 'user',
        },
      },
    );
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.text).toBe('Hello, AI!');
    expect(body.id).toBeDefined();
    messageId = body.id;
  });

  test('8. Get messages for conversation', async ({ request }) => {
    const response = await request.get(
      `/conversations/${oauthId}/${conversationId}/messages`,
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
    const found = body.find((m: any) => m.id === messageId);
    expect(found).toBeDefined();
  });

  test('9. Delete a message', async ({ request }) => {
    const response = await request.delete(
      `/conversations/${oauthId}/${conversationId}/messages/${messageId}`,
    );
    expect(response.status()).toBe(204);

    // Verify it's gone
    const fetchResponse = await request.get(
      `/conversations/${oauthId}/${conversationId}/messages`,
    );
    const body = await fetchResponse.json();
    const found = body.find((m: any) => m.id === messageId);
    expect(found).toBeUndefined();
  });

  test('10. Archive conversation', async ({ request }) => {
    const response = await request.patch(
      `/conversations/${oauthId}/${conversationId}/archive`,
      {
        data: {
          archived: true,
        },
      },
    );
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.archived).toBe(true);
  });

  test('11. Delete conversation', async ({ request }) => {
    const response = await request.delete(
      `/conversations/${oauthId}/${conversationId}`,
    );
    expect(response.status()).toBe(204);

    // Verify it's gone
    const fetchResponse = await request.get(
      `/conversations/${oauthId}/${conversationId}`,
    );
    expect(fetchResponse.status()).toBe(404); // Assuming 404 for not found
  });

  test('12. Delete user', async ({ request }) => {
    const response = await request.delete(`/users/${userId}`);
    expect(response.status()).toBe(204);

    // Verify user is gone
    const fetchResponse = await request.get(`/users/${userId}`);
    expect(fetchResponse.status()).toBe(404); // Assuming 404 for not found
  });
});
