/**
 * models.test.js
 * ---------------
 * Plain-language summary:
 * These tests check the three "model" classes completely on their
 * own - Task, PriorityTask, and User - with no network calls and no
 * other files involved. This is "unit testing": testing one small
 * piece of code completely in isolation.
 *
 * Note on this project's style: these classes take a single options
 * object, e.g. `new Task({ id: 1, title: 'Buy milk' })`, rather than
 * separate positional arguments - so every test below constructs
 * objects that way to match the real source code in src/models.js.
 */

import { Task, PriorityTask, User } from '../../src/models.js';

describe('Task', () => {
  let task;

  beforeEach(() => {
    // Fresh task before every test, so tests never influence each other.
    task = new Task({ id: 1, title: 'Buy groceries', completed: false, userId: 7 });
  });

  describe('constructor', () => {
    it('initializes all properties correctly', () => {
      expect(task.id).toBe(1);
      expect(task.title).toBe('Buy groceries');
      expect(task.completed).toBe(false);
      expect(task.userId).toBe(7);
    });

    it('defaults completed to false when omitted', () => {
      const t = new Task({ id: 2, title: 'No status given' });
      expect(t.completed).toBe(false);
    });

    it('throws a TypeError when id is missing', () => {
      expect(() => new Task({ title: 'No id' })).toThrow(TypeError);
      expect(() => new Task({ title: 'No id' })).toThrow('Task requires at least an id and a title');
    });

    it('throws a TypeError when title is missing', () => {
      expect(() => new Task({ id: 3 })).toThrow(TypeError);
    });

    it('throws when called with no arguments at all', () => {
      expect(() => new Task()).toThrow(TypeError);
    });

    it('accepts id 0 as valid (falsy but legitimate)', () => {
      const t = new Task({ id: 0, title: 'Zero id task' });
      expect(t.id).toBe(0);
    });

    it('accepts an explicit completed: true at construction time', () => {
      const t = new Task({ id: 4, title: 'Already done', completed: true });
      expect(t.completed).toBe(true);
    });
  });

  describe('toggle()', () => {
    it('flips completed from false to true', () => {
      expect(task.completed).toBe(false);
      task.toggle();
      expect(task.completed).toBe(true);
    });

    it('flips completed from true back to false', () => {
      task.toggle();
      task.toggle();
      expect(task.completed).toBe(false);
    });

    it('returns "this" so calls can be chained', () => {
      const result = task.toggle();
      expect(result).toBe(task);
    });
  });

  describe('getStatus()', () => {
    it('returns "Pending" when not completed', () => {
      expect(task.getStatus()).toBe('Pending');
    });

    it('returns "Completed" when completed', () => {
      task.toggle();
      expect(task.getStatus()).toBe('Completed');
    });
  });

  describe('isOverdue()', () => {
    it('always returns false for a plain Task (no due-date concept)', () => {
      expect(task.isOverdue()).toBe(false);
    });
  });

  describe('toJSON()', () => {
    it('serializes exactly the expected plain fields', () => {
      expect(task.toJSON()).toEqual({ id: 1, title: 'Buy groceries', completed: false, userId: 7 });
    });

    it('is used automatically by JSON.stringify()', () => {
      const json = JSON.stringify(task);
      expect(JSON.parse(json)).toEqual(task.toJSON());
    });
  });
});

describe('PriorityTask', () => {
  let pTask;

  beforeEach(() => {
    pTask = new PriorityTask({
      id: 20,
      title: 'Submit taxes',
      completed: false,
      userId: 5,
      priority: 'high',
      dueDate: '2099-04-15',
    });
  });

  describe('inheritance', () => {
    it('is an instance of both PriorityTask and Task', () => {
      expect(pTask).toBeInstanceOf(PriorityTask);
      expect(pTask).toBeInstanceOf(Task);
    });

    it('inherits base Task properties correctly', () => {
      expect(pTask.title).toBe('Submit taxes');
      expect(pTask.userId).toBe(5);
    });

    it('still enforces the base Task id/title validation', () => {
      expect(() => new PriorityTask({ title: 'no id' })).toThrow(TypeError);
    });

    it('throws the same validation error when constructed with no arguments at all', () => {
      expect(() => new PriorityTask()).toThrow(TypeError);
    });

    it('inherits toggle() from the base Task unchanged', () => {
      pTask.toggle();
      expect(pTask.completed).toBe(true);
    });
  });

  describe('priority-specific properties', () => {
    it('stores the priority level and due date', () => {
      expect(pTask.priority).toBe('high');
      expect(pTask.dueDate).toBeInstanceOf(Date);
    });

    it('defaults priority to "medium" when not specified', () => {
      const t = new PriorityTask({ id: 21, title: 'Default priority' });
      expect(t.priority).toBe('medium');
    });

    it('defaults dueDate to null when not specified', () => {
      const t = new PriorityTask({ id: 22, title: 'No due date' });
      expect(t.dueDate).toBeNull();
    });
  });

  describe('priorityWeight getter', () => {
    it('returns 3 for "high"', () => {
      expect(pTask.priorityWeight).toBe(3);
    });

    it('returns 2 for "medium" and 1 for "low"', () => {
      const medium = new PriorityTask({ id: 23, title: 'Medium', priority: 'medium' });
      const low = new PriorityTask({ id: 24, title: 'Low', priority: 'low' });
      expect(medium.priorityWeight).toBe(2);
      expect(low.priorityWeight).toBe(1);
    });

    it('returns 0 for an unrecognized priority value', () => {
      const weird = new PriorityTask({ id: 25, title: 'Weird', priority: 'urgent' });
      expect(weird.priorityWeight).toBe(0);
    });
  });

  describe('overridden isOverdue()', () => {
    it('returns true for a past due date on an incomplete task', () => {
      const late = new PriorityTask({ id: 26, title: 'Late', dueDate: '2020-01-01' });
      expect(late.isOverdue()).toBe(true);
    });

    it('returns false for a future due date', () => {
      expect(pTask.isOverdue()).toBe(false);
    });

    it('returns false when there is no due date at all', () => {
      const noDate = new PriorityTask({ id: 27, title: 'No date' });
      expect(noDate.isOverdue()).toBe(false);
    });

    it('returns false for a past due date if the task is already completed', () => {
      const doneLate = new PriorityTask({ id: 28, title: 'Done late', completed: true, dueDate: '2020-01-01' });
      expect(doneLate.isOverdue()).toBe(false);
    });
  });

  describe('overridden getStatus()', () => {
    it('includes the priority level when completed', () => {
      pTask.toggle();
      expect(pTask.getStatus()).toBe('Completed (high priority)');
    });

    it('shows "Overdue" text when the due date has passed and it is incomplete', () => {
      const late = new PriorityTask({ id: 29, title: 'Late', priority: 'medium', dueDate: '2020-01-01' });
      expect(late.getStatus()).toMatch(/Overdue/);
    });

    it('shows "Pending" text with priority when not yet due', () => {
      expect(pTask.getStatus()).toBe('Pending — high priority');
    });
  });

  describe('toJSON()', () => {
    it('includes base fields plus priority and dueDate', () => {
      const json = pTask.toJSON();
      expect(json).toMatchObject({ id: 20, title: 'Submit taxes', priority: 'high' });
      expect(json.dueDate).toBeInstanceOf(Date);
    });
  });
});

describe('User', () => {
  let user;
  let taskA;
  let taskB;

  beforeEach(() => {
    user = new User({ id: 1, name: 'Diana Prince', email: 'diana@example.com' });
    taskA = new Task({ id: 1, title: 'Task A', completed: true });
    taskB = new Task({ id: 2, title: 'Task B', completed: false });
  });

  describe('constructor', () => {
    it('initializes with an empty tasks array', () => {
      expect(user.tasks).toEqual([]);
    });

    it('stores id, name, and email', () => {
      expect(user.id).toBe(1);
      expect(user.name).toBe('Diana Prince');
      expect(user.email).toBe('diana@example.com');
    });

    it('does not throw when constructed with no arguments at all (unlike Task/PriorityTask)', () => {
      const empty = new User();
      expect(empty.id).toBeUndefined();
      expect(empty.tasks).toEqual([]);
    });
  });

  describe('addTask()', () => {
    it('adds a task to the tasks array', () => {
      user.addTask(taskA);
      expect(user.tasks).toHaveLength(1);
      expect(user.tasks[0]).toBe(taskA);
    });

    it('returns "this" so calls can be chained', () => {
      const result = user.addTask(taskA).addTask(taskB);
      expect(result).toBe(user);
      expect(user.tasks).toHaveLength(2);
    });
  });

  describe('getCompletionRate()', () => {
    it('returns 0 for a user with no tasks (no division-by-zero crash)', () => {
      expect(user.getCompletionRate()).toBe(0);
    });

    it('returns 100 when all tasks are completed', () => {
      user.addTask(taskA);
      expect(user.getCompletionRate()).toBe(100);
    });

    it('returns 0 when no tasks are completed', () => {
      user.addTask(taskB);
      expect(user.getCompletionRate()).toBe(0);
    });

    it('returns a correctly rounded (1-decimal) percentage for an uneven split', () => {
      user.addTask(taskA); // completed
      user.addTask(taskB); // pending
      user.addTask(new Task({ id: 3, title: 'Task C', completed: false }));
      // 1 of 3 completed = 33.333...% -> rounds to 33.3
      expect(user.getCompletionRate()).toBe(33.3);
    });
  });

  describe('getTasksByStatus()', () => {
    beforeEach(() => {
      user.addTask(taskA).addTask(taskB);
    });

    it('returns all tasks (a copy) when status is "all" (the default)', () => {
      const all = user.getTasksByStatus();
      expect(all).toEqual([taskA, taskB]);
      expect(all).not.toBe(user.tasks); // must be a copy, not the live array
    });

    it('returns only completed tasks when asked', () => {
      expect(user.getTasksByStatus('completed')).toEqual([taskA]);
    });

    it('returns only pending tasks when asked', () => {
      expect(user.getTasksByStatus('pending')).toEqual([taskB]);
    });

    it('returns an empty array when nothing matches for a fresh user', () => {
      const emptyUser = new User({ id: 9, name: 'Empty User' });
      expect(emptyUser.getTasksByStatus('completed')).toEqual([]);
    });
  });

  describe('toJSON()', () => {
    it('includes computed taskCount and completionRate alongside basic fields', () => {
      user.addTask(taskA).addTask(taskB);
      expect(user.toJSON()).toEqual({
        id: 1,
        name: 'Diana Prince',
        email: 'diana@example.com',
        taskCount: 2,
        completionRate: 50,
      });
    });
  });
});
