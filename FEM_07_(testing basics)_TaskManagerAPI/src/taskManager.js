import { APIClient } from './api.js';
import { PriorityTask, User } from './models.js';
import * as processor from './taskProcessor.js';

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

// Orchestrates API + models + processing. Deliberately has no I/O of its own
// beyond the injected APIClient (no node:fs, no node:readline), so it runs
// unchanged in Node (src/main.js CLI) or a browser (app.js).
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
}
