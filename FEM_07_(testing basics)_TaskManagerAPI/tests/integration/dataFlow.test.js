/**
 * dataFlow.test.js
 * -----------------
 * Plain-language summary:
 * These are "full workflow" integration tests. Instead of testing one
 * piece in isolation, each test plays out a whole realistic journey
 * through this project's own orchestrator, `TaskManager`: fetch data
 * (from a mocked network) -> build real PriorityTask/User objects ->
 * run it through the processing functions -> check the final result,
 * and in one case, write it all the way out to a real JSON file. This
 * is how we confirm all the pieces actually cooperate when wired
 * together exactly as `src/main.js` wires them in real life.
 */

import { TaskManager } from '../../src/taskManager.js';
import { APIError } from '../../src/errors.js';
import { exportToJSON } from '../../src/exporter.js';
import { calculateStatistics } from '../../src/taskProcessor.js';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const mockUsers = [
  { id: 1, name: 'Leanne Graham', email: 'leanne@example.com' },
  { id: 2, name: 'Ervin Howell', email: 'ervin@example.com' },
];

const mockTodos = [
  { id: 1, userId: 1, title: 'Buy groceries', completed: false },
  { id: 2, userId: 1, title: 'Finish report', completed: true },
  { id: 3, userId: 2, title: 'Book flights', completed: false },
];

function installMockFetch(handler) {
  global.fetch = jest.fn(handler);
}

describe('Complete data-flow workflows (TaskManager end-to-end)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it('Workflow 1: load() fetches users+todos, builds PriorityTask/User objects, and attaches tasks to owners', async () => {
    installMockFetch(async (url) => {
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    expect(manager.tasks).toHaveLength(3);
    expect(manager.getUserList()).toHaveLength(2);

    const owner = manager.getUserList().find((u) => u.id === 1);
    expect(owner.tasks).toHaveLength(2); // both of user 1's todos were attached
    expect(owner.getCompletionRate()).toBe(50);
  });

  it('Workflow 2: getStatistics() reflects the real loaded data via calculateStatistics()', async () => {
    installMockFetch(async (url) => {
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    const stats = manager.getStatistics();
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    // Cross-check against calling the processing function directly on the same tasks.
    expect(stats).toEqual(calculateStatistics(manager.tasks));
  });

  it('Workflow 3: search() and getTasksByUser() operate correctly on real loaded PriorityTask instances', async () => {
    installMockFetch(async (url) => {
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    const searchResults = manager.search('report');
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].title).toBe('Finish report');

    const user2Tasks = manager.getTasksByUser(2);
    expect(user2Tasks).toHaveLength(1);
    expect(user2Tasks[0].userId).toBe(2);
  });

  it('Workflow 4: a server error during load() propagates as an APIError, leaving no partial state applied', async () => {
    installMockFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));

    const manager = new TaskManager();
    await expect(manager.load()).rejects.toThrow(APIError);
    expect(manager.tasks).toEqual([]);
    expect(manager.getUserList()).toEqual([]);
  });

  it('Workflow 5: full pipeline from mocked API through to a real exported JSON file on disk', async () => {
    installMockFetch(async (url) => {
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    const filePath = path.join(os.tmpdir(), `task-manager-dataflow-test-${Date.now()}.json`);
    await exportToJSON(
      { tasks: manager.tasks, users: manager.getUserList(), statistics: manager.getStatistics() },
      filePath
    );

    const contents = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(contents.tasks).toHaveLength(3);
    expect(contents.users).toHaveLength(2);
    expect(contents.statistics.total).toBe(3);
    expect(contents.exportedAt).toBeTruthy();

    await unlink(filePath); // clean up after ourselves
  });

  it('Workflow 6: fetchTodosPerUser() drives the rate-limited per-user fetch from real loaded users', async () => {
    installMockFetch(async (url) => {
      // Check the more specific "/users/:id/todos" pattern FIRST - it also
      // ends with "/todos", so checking the generic todos endpoint first
      // would incorrectly swallow these per-user requests.
      const perUserMatch = url.match(/\/users\/(\d+)\/todos/);
      if (perUserMatch) {
        const userId = Number(perUserMatch[1]);
        return { ok: true, status: 200, json: async () => mockTodos.filter((t) => t.userId === userId) };
      }
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    const todosByUser = await manager.fetchTodosPerUser({ concurrency: 2 });
    expect(todosByUser.get(1)).toHaveLength(2);
    expect(todosByUser.get(2)).toHaveLength(1);
  });

  it('Workflow 6b: fetchTodosPerUser() falls back to the default concurrency of 3 when called with no arguments', async () => {
    installMockFetch(async (url) => {
      const perUserMatch = url.match(/\/users\/(\d+)\/todos/);
      if (perUserMatch) {
        const userId = Number(perUserMatch[1]);
        return { ok: true, status: 200, json: async () => mockTodos.filter((t) => t.userId === userId) };
      }
      if (url.endsWith('/users')) return { ok: true, status: 200, json: async () => mockUsers };
      if (url.endsWith('/todos')) return { ok: true, status: 200, json: async () => mockTodos };
      throw new Error('unexpected url: ' + url);
    });

    const manager = new TaskManager();
    await manager.load();

    const todosByUser = await manager.fetchTodosPerUser(); // no argument at all
    expect(todosByUser.get(1)).toHaveLength(2);
    expect(todosByUser.get(2)).toHaveLength(1);
  });

  it('exportToJSON() falls back to safe empty defaults when called with no data object at all', async () => {
    const filePath = path.join(os.tmpdir(), `task-manager-export-defaults-test-${Date.now()}.json`);
    await exportToJSON(undefined, filePath);

    const contents = JSON.parse(await readFile(filePath, 'utf-8'));
    expect(contents.tasks).toEqual([]);
    expect(contents.users).toEqual([]);
    expect(contents.statistics).toEqual({});

    await unlink(filePath);
  });
});
