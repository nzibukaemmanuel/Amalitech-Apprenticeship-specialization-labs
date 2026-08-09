import assert from 'node:assert';
import { APIClient } from '../src/api.js';
import { APIError } from '../src/errors.js';
import { TaskManager } from '../src/taskManager.js';

const mockUsers = [
  { id: 1, name: 'Leanne Graham', email: 'leanne@example.com' },
  { id: 2, name: 'Ervin Howell', email: 'ervin@example.com' }
];

const mockTodos = [
  { id: 1, userId: 1, title: 'Buy groceries', completed: false },
  { id: 2, userId: 1, title: 'Finish report', completed: true },
  { id: 3, userId: 2, title: 'Book flights', completed: false }
];

function installMockFetch(behavior) {
  globalThis.fetch = behavior;
}

// --- Test 1: successful fetchAll + Promise.all concurrency ---
{
  let callCount = 0;
  installMockFetch(async (url) => {
    callCount += 1;
    if (url.endsWith('/users')) {
      return { ok: true, status: 200, json: async () => mockUsers };
    }
    if (url.endsWith('/todos')) {
      return { ok: true, status: 200, json: async () => mockTodos };
    }
    throw new Error('unexpected url: ' + url);
  });

  const client = new APIClient();
  const { users, todos } = await client.fetchAll();
  assert.strictEqual(users.length, 2);
  assert.strictEqual(todos.length, 3);
  assert.strictEqual(callCount, 2, 'fetchAll should hit both endpoints exactly once');
  console.log('✔ APIClient.fetchAll (mocked, concurrent)');

  // Caching: calling fetchUsers again should NOT trigger another network call
  await client.fetchUsers();
  assert.strictEqual(callCount, 2, 'cached fetchUsers should not call fetch again');
  console.log('✔ APIClient caching prevents duplicate network calls');
}

// --- Test 2: HTTP error status handling ---
{
  installMockFetch(async () => ({ ok: false, status: 404, json: async () => ({}) }));
  const client = new APIClient();

  await assert.rejects(
    () => client.fetchUsers(),
    (err) => {
      assert.ok(err instanceof APIError);
      assert.strictEqual(err.status, 404);
      return true;
    }
  );
  console.log('✔ APIClient throws APIError on non-ok HTTP status');
}

// --- Test 3: network failure (fetch itself throws) ---
{
  installMockFetch(async () => {
    throw new Error('DNS lookup failed');
  });
  const client = new APIClient();

  await assert.rejects(
    () => client.fetchTodos(),
    (err) => {
      assert.ok(err instanceof APIError);
      assert.ok(err.cause);
      return true;
    }
  );
  console.log('✔ APIClient wraps network-level failures in APIError');
}

// --- Test 4: malformed JSON response ---
{
  installMockFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token'); }
  }));
  const client = new APIClient();

  await assert.rejects(() => client.fetchUsers(), APIError);
  console.log('✔ APIClient throws APIError on malformed JSON');
}

// --- Test 5: non-array response degrades gracefully ---
{
  installMockFetch(async () => ({ ok: true, status: 200, json: async () => ({ notAnArray: true }) }));
  const client = new APIClient();
  const users = await client.fetchUsers();
  assert.deepStrictEqual(users, [], 'non-array API response should degrade to empty array, not throw');
  console.log('✔ APIClient handles malformed (non-array) response body gracefully');
}

// --- Test 6: full TaskManager.load() pipeline end-to-end (mocked) ---
{
  installMockFetch(async (url) => {
    if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
    if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
    throw new Error('unexpected url: ' + url);
  });

  const manager = new TaskManager();
  await manager.load();

  assert.strictEqual(manager.tasks.length, 3);
  assert.strictEqual(manager.getUserList().length, 2);

  const user1Tasks = manager.getTasksByUser(1);
  assert.strictEqual(user1Tasks.length, 2);

  const stats = manager.getStatistics();
  assert.strictEqual(stats.total, 3);
  assert.strictEqual(stats.completed, 1);

  const owner = [...manager.users.values()].find((u) => u.id === 1);
  assert.strictEqual(owner.tasks.length, 2, 'User.addTask should have been called during load()');
  assert.strictEqual(owner.getCompletionRate(), 50);

  console.log('✔ TaskManager.load() end-to-end pipeline (mocked network)');
}

// --- Test 7: TaskManager.load() propagates API errors correctly ---
{
  installMockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
  const manager = new TaskManager();

  await assert.rejects(
    () => manager.load(),
    (err) => {
      assert.ok(err instanceof APIError);
      return true;
    }
  );
  console.log('✔ TaskManager.load() propagates APIError on server failure');
}

// --- Test 8: fetchTodosForUsers caps concurrent in-flight requests ---
{
  let active = 0;
  let maxActive = 0;

  installMockFetch(async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;

    const userId = Number(url.match(/\/users\/(\d+)\/todos/)[1]);
    return { ok: true, status: 200, json: async () => mockTodos.filter((t) => t.userId === userId) };
  });

  const client = new APIClient();
  const todosByUser = await client.fetchTodosForUsers([1, 2, 3, 4, 5], { concurrency: 2 });

  assert.ok(maxActive <= 2, `expected at most 2 concurrent requests, saw ${maxActive}`);
  assert.strictEqual(todosByUser.get(1).length, 2);
  assert.strictEqual(todosByUser.get(2).length, 1);
  console.log('✔ APIClient.fetchTodosForUsers caps concurrency via rate limiter');
}

console.log('\nAll integration tests passed (mocked network).');
