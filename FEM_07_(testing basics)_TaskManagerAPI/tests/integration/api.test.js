/**
 * api.test.js
 * ------------
 * Plain-language summary:
 * This is "integration testing" for the network layer. We never let
 * tests reach out to the real internet - instead we replace the
 * global `fetch` function with a fake one we fully script
 * (`jest.fn()`), so we can test every situation on demand: success, a
 * 404, a 500, a dead connection, malformed JSON, and — specific to
 * this project — the built-in caching (does a second call to the same
 * endpoint skip the network entirely?) and the concurrency-limited
 * `fetchTodosForUsers`.
 */

import { APIClient } from '../../src/api.js';
import { APIError } from '../../src/errors.js';

const mockUsers = [
  { id: 1, name: 'Leanne Graham', email: 'leanne@example.com' },
  { id: 2, name: 'Ervin Howell', email: 'ervin@example.com' },
];

const mockTodos = [
  { id: 1, userId: 1, title: 'Buy groceries', completed: false },
  { id: 2, userId: 1, title: 'Finish report', completed: true },
  { id: 3, userId: 2, title: 'Book flights', completed: false },
];

describe('APIClient integration tests', () => {
  let client;

  beforeEach(() => {
    client = new APIClient('https://mock-api.test');
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  describe('fetchUsers()', () => {
    it('returns parsed user data on a successful call', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockUsers) });
      const users = await client.fetchUsers();
      expect(users).toEqual(mockUsers);
    });

    it('calls fetch with the correct endpoint URL', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await client.fetchUsers();
      expect(global.fetch).toHaveBeenCalledWith('https://mock-api.test/users');
    });

    it('throws an APIError carrying the status code on a 500 server error', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
      await expect(client.fetchUsers()).rejects.toThrow(APIError);
      try {
        await client.fetchUsers();
      } catch (err) {
        expect(err.status).toBe(500);
      }
    });

    it('throws an APIError with status 404 on a not-found response', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve({}) });
      await expect(client.fetchUsers()).rejects.toMatchObject({ status: 404 });
    });

    it('wraps a total network failure in an APIError carrying the original cause', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND');
      global.fetch.mockRejectedValue(networkError);
      await expect(client.fetchUsers()).rejects.toThrow(APIError);
      try {
        await client.fetchUsers();
      } catch (err) {
        expect(err.cause).toBe(networkError);
      }
    });

    it('wraps a JSON parsing failure in an APIError', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });
      await expect(client.fetchUsers()).rejects.toThrow(APIError);
    });

    it('degrades gracefully to an empty array when the response body is not an array', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ notAnArray: true }) });
      const users = await client.fetchUsers();
      expect(users).toEqual([]);
    });
  });

  describe('fetchTodos()', () => {
    it('returns parsed todo data on a successful call', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockTodos) });
      const todos = await client.fetchTodos();
      expect(todos).toEqual(mockTodos);
    });

    it('calls fetch with the correct endpoint URL', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await client.fetchTodos();
      expect(global.fetch).toHaveBeenCalledWith('https://mock-api.test/todos');
    });

    it('degrades gracefully to an empty array when the response body is not an array', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ oops: true }) });
      expect(await client.fetchTodos()).toEqual([]);
    });
  });

  describe('fetchUserTodos()', () => {
    it('calls fetch with the correct user-specific endpoint', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await client.fetchUserTodos(1);
      expect(global.fetch).toHaveBeenCalledWith('https://mock-api.test/users/1/todos');
    });

    it('returns only that user\'s todos on success', async () => {
      const userOneTodos = mockTodos.filter((t) => t.userId === 1);
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(userOneTodos) });
      const result = await client.fetchUserTodos(1);
      expect(result).toEqual(userOneTodos);
    });

    it('degrades gracefully to an empty array when the response body is not an array', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(null) });
      expect(await client.fetchUserTodos(1)).toEqual([]);
    });
  });

  describe('caching behavior', () => {
    it('does not call fetch again for a repeated fetchUsers() call (same client instance)', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockUsers) });
      await client.fetchUsers();
      await client.fetchUsers();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('caches fetchUserTodos() per distinct userId, not globally', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      await client.fetchUserTodos(1);
      await client.fetchUserTodos(2);
      await client.fetchUserTodos(1); // repeat of the first -> should not hit the network again
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchAll()', () => {
    it('fetches users and todos concurrently via Promise.all', async () => {
      global.fetch.mockImplementation((url) => {
        if (url.endsWith('/users')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockUsers) });
        if (url.endsWith('/todos')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockTodos) });
        return Promise.reject(new Error('unexpected url'));
      });

      const { users, todos } = await client.fetchAll();
      expect(users).toEqual(mockUsers);
      expect(todos).toEqual(mockTodos);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchUsersPromiseStyle() (plain Promise-chain variant)', () => {
    it('resolves with user data on success without using async/await internally', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(mockUsers) });
      const users = await client.fetchUsersPromiseStyle();
      expect(users).toEqual(mockUsers);
    });

    it('rejects with an APIError on a non-OK status', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) });
      await expect(client.fetchUsersPromiseStyle()).rejects.toThrow(APIError);
    });

    it('wraps a rejected fetch() call in an APIError', async () => {
      global.fetch.mockRejectedValue(new Error('connection reset'));
      await expect(client.fetchUsersPromiseStyle()).rejects.toThrow(APIError);
    });
  });

  describe('fetchTodosForUsers() (rate-limited concurrent fetch)', () => {
    it('never exceeds the given concurrency limit', async () => {
      let active = 0;
      let maxActive = 0;

      global.fetch.mockImplementation(async (url) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        const userId = Number(url.match(/\/users\/(\d+)\/todos/)[1]);
        return { ok: true, status: 200, json: () => Promise.resolve(mockTodos.filter((t) => t.userId === userId)) };
      });

      const todosByUser = await client.fetchTodosForUsers([1, 2, 3, 4, 5], { concurrency: 2 });
      expect(maxActive).toBeLessThanOrEqual(2);
      expect(todosByUser.get(1)).toHaveLength(2);
      expect(todosByUser.get(2)).toHaveLength(1);
    });

    it('returns a Map keyed by the original userIds, one entry per user', async () => {
      global.fetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
      const todosByUser = await client.fetchTodosForUsers([10, 20, 30]);
      expect(todosByUser).toBeInstanceOf(Map);
      expect([...todosByUser.keys()]).toEqual([10, 20, 30]);
    });
  });
});
