import assert from 'node:assert';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PriorityTask, User } from '../src/models.js';
import { calculateStatistics, groupByUser, sortTasks, byPriorityDesc, searchTasks } from '../src/taskProcessor.js';
import { createCache, withCache } from '../src/cache.js';
import { runWithConcurrencyLimit } from '../src/rateLimiter.js';
import { exportToJSON } from '../src/exporter.js';

const tasks = [
  new PriorityTask({ id: 1, title: 'Zebra task', userId: 1, completed: false, priority: 'low' }),
  new PriorityTask({ id: 2, title: 'Alpha task', userId: 1, completed: true, priority: 'high' }),
  new PriorityTask({ id: 3, title: 'Middle task', userId: 2, completed: false, priority: 'medium' })
];

// --- calculateStatistics ---
const stats = calculateStatistics(tasks);
assert.strictEqual(stats.total, 3);
assert.strictEqual(stats.completed, 1);
assert.strictEqual(stats.pending, 2);
assert.strictEqual(stats.completionRate, 33.3);
console.log('✔ calculateStatistics');

// --- groupByUser ---
const grouped = groupByUser(tasks);
assert.strictEqual(grouped.get(1).length, 2);
assert.strictEqual(grouped.get(2).length, 1);
assert.ok(grouped instanceof Map);
console.log('✔ groupByUser');

// --- sortTasks with comparator ---
const sorted = sortTasks(tasks, byPriorityDesc);
assert.strictEqual(sorted[0].priority, 'high');
assert.strictEqual(sorted[sorted.length - 1].priority, 'low');
console.log('✔ sortTasks / byPriorityDesc');

// --- searchTasks ---
const results = searchTasks(tasks, 'alpha');
assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].id, 2);
console.log('✔ searchTasks');

// --- User class ---
const user = new User({ id: 1, name: 'Test User' });
user.addTask(tasks[0]).addTask(tasks[1]);
assert.strictEqual(user.getCompletionRate(), 50);
assert.strictEqual(user.getTasksByStatus('completed').length, 1);
console.log('✔ User.getCompletionRate / getTasksByStatus');

// --- PriorityTask overdue logic ---
const overdueTask = new PriorityTask({
  id: 99, title: 'Old task', userId: 1, completed: false, priority: 'high', dueDate: '2020-01-01'
});
assert.strictEqual(overdueTask.isOverdue(), true);
assert.match(overdueTask.getStatus(), /Overdue/);

const completedOverdueTask = new PriorityTask({
  id: 100, title: 'Done but old', userId: 1, completed: true, priority: 'high', dueDate: '2020-01-01'
});
assert.strictEqual(completedOverdueTask.isOverdue(), false, 'completed tasks are never overdue');
console.log('✔ PriorityTask.isOverdue / getStatus');

// --- Task base class edge cases ---
assert.throws(() => new PriorityTask({ title: 'no id' }), TypeError);
console.log('✔ Task validation throws on missing id');

// --- Empty input edge cases ---
const emptyStats = calculateStatistics([]);
assert.strictEqual(emptyStats.total, 0);
assert.strictEqual(emptyStats.completionRate, 0);
console.log('✔ calculateStatistics handles empty array');

// --- Closure-based cache ---
const cache = createCache();
let callCount = 0;
const expensiveFn = async (x) => {
  callCount += 1;
  return x * 2;
};
const cachedFn = withCache(cache, (x) => `key:${x}`, expensiveFn);

const r1 = await cachedFn(5);
const r2 = await cachedFn(5); // should hit cache, not call expensiveFn again
assert.strictEqual(r1, 10);
assert.strictEqual(r2, 10);
assert.strictEqual(callCount, 1, 'expensiveFn should only run once due to caching');
assert.strictEqual(cache.stats.hits, 1);
assert.strictEqual(cache.stats.misses, 1);
console.log('✔ createCache / withCache memoization');

// --- runWithConcurrencyLimit (bonus: rate limiting) ---
{
  let active = 0;
  let maxActive = 0;
  const items = [1, 2, 3, 4, 5, 6];

  const worker = async (n) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return n * 10;
  };

  const results = await runWithConcurrencyLimit(items, worker, 2);
  assert.deepStrictEqual(results, [10, 20, 30, 40, 50, 60], 'results must preserve input order');
  assert.ok(maxActive <= 2, `never more than 2 concurrent workers, saw ${maxActive}`);
  console.log('✔ runWithConcurrencyLimit caps concurrency and preserves order');
}

// --- exportToJSON (bonus: data export) ---
{
  const task = new PriorityTask({ id: 1, title: 'Export me', userId: 1, completed: false, priority: 'high' });
  const exportUser = new User({ id: 1, name: 'Export User', email: 'export@example.com' });
  exportUser.addTask(task);

  const filePath = path.join(os.tmpdir(), `task-manager-export-test-${Date.now()}.json`);
  await exportToJSON(
    { tasks: [task], users: [exportUser], statistics: calculateStatistics([task]) },
    filePath
  );

  const contents = JSON.parse(await readFile(filePath, 'utf-8'));
  assert.strictEqual(contents.tasks.length, 1);
  assert.strictEqual(contents.tasks[0].title, 'Export me');
  assert.strictEqual(contents.users[0].name, 'Export User');
  assert.strictEqual(contents.statistics.total, 1);
  assert.ok(contents.exportedAt);

  await unlink(filePath);
  console.log('✔ exportToJSON writes a well-formed export file');
}

console.log('\nAll smoke tests passed.');
