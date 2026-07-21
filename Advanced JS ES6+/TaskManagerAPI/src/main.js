import readline from 'node:readline';
import { pathToFileURL } from 'node:url';
import { APIClient } from './api.js';
import { PriorityTask, User } from './models.js';
import * as processor from './taskProcessor.js';
import { exportToJSON } from './exporter.js';

const PRIORITIES = ['low', 'medium', 'high'];

// JSONPlaceholder todos have no priority/dueDate fields, so we derive
// deterministic pseudo-values from the todo id — same id always gives the
// same priority/date, so results are stable across runs.
function derivePriority(todo) {
  return PRIORITIES[todo.id % PRIORITIES.length];
}

function deriveDueDate(todo) {
  const daysOffset = (todo.id % 14) - 7; // spread across past + future
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

export class TaskManager {
  constructor(apiClient = new APIClient()) {
    this.api = apiClient;
    this.users = new Map();
    this.tasks = [];
  }

  async load() {
    const { users: rawUsers, todos: rawTodos } = await this.api.fetchAll();

    rawUsers.forEach(({ id, name, email }) => {
      this.users.set(id, new User({ id, name, email }));
    });

    this.tasks = rawTodos.map((todo) => {
      const task = new PriorityTask({
        id: todo.id,
        title: todo.title,
        completed: todo.completed,
        userId: todo.userId,
        priority: derivePriority(todo),
        dueDate: deriveDueDate(todo)
      });
      this.users.get(task.userId)?.addTask(task);
      return task;
    });

    return this;
  }

  getStatistics() {
    return processor.calculateStatistics(this.tasks);
  }

  getTasksByUser(userId) {
    return processor.filterByUser(this.tasks, userId);
  }

  search(query) {
    return processor.searchTasks(this.tasks, query);
  }

  getUserList() {
    return [...this.users.values()];
  }

  // Bonus: rate-limited concurrent per-user fetch, demonstrated separately
  // from the cached bulk fetchTodos() used in load().
  async fetchTodosPerUser({ concurrency = 3 } = {}) {
    const userIds = this.getUserList().map((user) => user.id);
    return this.api.fetchTodosForUsers(userIds, { concurrency });
  }

  // Bonus: export the current in-memory state to a JSON file.
  async exportData(filePath = 'export.json') {
    return exportToJSON(
      {
        tasks: this.tasks,
        users: this.getUserList(),
        statistics: this.getStatistics()
      },
      filePath
    );
  }
}

// ---------- CLI ----------

function printTaskLine(task) {
  const flag = task.completed ? '✔' : task.isOverdue() ? '!' : ' ';
  console.log(`  [${flag}] #${task.id} ${task.title} — ${task.getStatus()}`);
}

function printStats(stats) {
  console.log(
    `\nTotal: ${stats.total} | Completed: ${stats.completed} | Pending: ${stats.pending} | ` +
    `Completion rate: ${stats.completionRate}% | Overdue: ${stats.overdueCount}`
  );
  console.log('By priority:', stats.byPriority);
}

async function runCli(manager) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // If stdin ends unexpectedly (redirected input running dry, Ctrl+D, a
  // non-interactive/piped environment), readline closes itself. That can
  // happen either before a question is asked (rl.question() would otherwise
  // throw ERR_USE_AFTER_CLOSE) or while one is still pending (the question's
  // own callback then never fires, silently hanging the app). Both cases are
  // treated as "the user chose to exit" via a fake '0' answer.
  let closed = false;
  let pendingResolve = null;
  rl.on('close', () => {
    closed = true;
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve('0');
    }
  });
  const ask = (question) => new Promise((resolve) => {
    if (closed) return resolve('0');
    pendingResolve = resolve;
    rl.question(question, (answer) => {
      pendingResolve = null;
      resolve(answer);
    });
  });

  const menu = `
=== Task Manager ===
1) Show statistics
2) List all tasks
3) List tasks by user
4) Search tasks
5) Sort tasks (priority, then title)
6) Show cache stats
7) Fetch todos per user (rate-limited demo)
8) Export data to JSON
0) Exit
`;

  let running = true;
  while (running) {
    console.log(menu);
    const choice = (await ask('Choose an option: ')).trim();

    switch (choice) {
      case '1':
        printStats(manager.getStatistics());
        break;
      case '2':
        manager.tasks.forEach(printTaskLine);
        break;
      case '3': {
        const userId = Number(await ask('User ID: '));
        const userTasks = manager.getTasksByUser(userId);
        userTasks.length ? userTasks.forEach(printTaskLine) : console.log('No tasks found for that user.');
        break;
      }
      case '4': {
        const query = await ask('Search text: ');
        const results = manager.search(query);
        console.log(`${results.length} result(s):`);
        results.forEach(printTaskLine);
        break;
      }
      case '5': {
        const sorted = processor.sortTasks(manager.tasks, processor.byPriorityDesc, processor.byTitleAsc);
        sorted.slice(0, 15).forEach(printTaskLine);
        if (sorted.length > 15) console.log(`...and ${sorted.length - 15} more`);
        break;
      }
      case '6':
        console.log(manager.api.cache.stats);
        break;
      case '7': {
        console.log('Fetching todos per user with concurrency capped at 3...');
        const start = performance.now();
        const todosByUser = await manager.fetchTodosPerUser({ concurrency: 3 });
        const elapsed = Math.round(performance.now() - start);
        for (const [userId, todos] of todosByUser) {
          console.log(`  User ${userId}: ${todos.length} todo(s)`);
        }
        console.log(`Done in ${elapsed}ms (served from cache after the first run).`);
        break;
      }
      case '8': {
        const fileName = (await ask('Export file name [export.json]: ')).trim() || 'export.json';
        const savedTo = await manager.exportData(fileName);
        console.log(`Exported ${manager.tasks.length} tasks and ${manager.getUserList().length} users to ${savedTo}`);
        break;
      }
      case '0':
        running = false;
        break;
      default:
        console.log('Not a valid option, try again.');
    }
  }

  rl.close();
}

async function main() {
  const manager = new TaskManager();
  console.log('Fetching users and todos from JSONPlaceholder...');

  try {
    await manager.load();
  } catch (error) {
    console.error('Failed to load data:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Loaded ${manager.getUserList().length} users and ${manager.tasks.length} tasks.`);
  await runCli(manager);
}

// Only auto-run when this file is executed directly (`node src/main.js`),
// not when it's imported elsewhere (e.g. by tests). Compared as file URLs
// (via pathToFileURL) rather than a raw string template, since Windows paths
// use backslashes and raw spaces while import.meta.url is always a
// forward-slash, percent-encoded file:// URL — a plain string match between
// the two silently never fires on Windows.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
