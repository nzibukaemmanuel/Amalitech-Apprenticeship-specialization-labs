export class Task {
  constructor({ id, title, completed = false, userId } = {}) {
    if (id === undefined || title === undefined) {
      throw new TypeError('Task requires at least an id and a title');
    }
    this.id = id;
    this.title = title;
    this.completed = completed;
    this.userId = userId;
  }

  toggle() {
    this.completed = !this.completed;
    return this;
  }

  // The base Task has no concept of a due date, so it's never overdue.
  isOverdue() {
    return false;
  }

  getStatus() {
    return this.completed ? 'Completed' : 'Pending';
  }

  toJSON() {
    const { id, title, completed, userId } = this;
    return { id, title, completed, userId };
  }
}

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

export class PriorityTask extends Task {
  constructor({ id, title, completed = false, userId, priority = 'medium', dueDate = null } = {}) {
    super({ id, title, completed, userId });
    this.priority = priority;
    this.dueDate = dueDate ? new Date(dueDate) : null;
  }

  isOverdue() {
    if (!this.dueDate || this.completed) return false;
    return Date.now() > this.dueDate.getTime();
  }

  get priorityWeight() {
    return PRIORITY_WEIGHT[this.priority] ?? 0;
  }

  // Overridden: adds priority + overdue context the base class doesn't have.
  getStatus() {
    if (this.completed) return `Completed (${this.priority} priority)`;
    if (this.isOverdue()) return `Overdue — ${this.priority} priority`;
    return `Pending — ${this.priority} priority`;
  }

  toJSON() {
    return { ...super.toJSON(), priority: this.priority, dueDate: this.dueDate };
  }
}

export class User {
  constructor({ id, name, email } = {}) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.tasks = [];
  }

  addTask(task) {
    this.tasks.push(task);
    return this;
  }

  getCompletionRate() {
    if (this.tasks.length === 0) return 0;
    const completed = this.tasks.reduce((count, t) => count + (t.completed ? 1 : 0), 0);
    return Number(((completed / this.tasks.length) * 100).toFixed(1));
  }

  getTasksByStatus(status = 'all') {
    if (status === 'all') return [...this.tasks];
    const wantCompleted = status === 'completed';
    return this.tasks.filter(({ completed }) => completed === wantCompleted);
  }

  toJSON() {
    const { id, name, email } = this;
    return { id, name, email, taskCount: this.tasks.length, completionRate: this.getCompletionRate() };
  }
}
