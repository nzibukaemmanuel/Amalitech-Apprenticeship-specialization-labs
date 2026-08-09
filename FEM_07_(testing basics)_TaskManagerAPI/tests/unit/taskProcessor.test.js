/**
 * taskProcessor.test.js
 * ----------------------
 * Plain-language summary:
 * These tests check the standalone "toolbox" functions that operate
 * on LISTS of tasks - filtering, searching, totalling stats, grouping
 * by user, and sorting. All of these are "pure functions": you give
 * them data, they hand back new data, and they never change the list
 * you gave them. Each function is tested with: normal data, empty
 * lists, and edge cases specific to what that function does.
 */

import { PriorityTask } from '../../src/models.js';
import {
  filterByStatus,
  filterByUser,
  filterByPriority,
  searchTasks,
  calculateStatistics,
  groupByUser,
  extractUniquePriorities,
  sortTasks,
  byPriorityDesc,
  byTitleAsc,
  byCompletedFirst,
} from '../../src/taskProcessor.js';

const buildTasks = () => [
  new PriorityTask({ id: 1, title: 'Zebra task', userId: 1, completed: false, priority: 'low' }),
  new PriorityTask({ id: 2, title: 'Alpha task', userId: 1, completed: true, priority: 'high' }),
  new PriorityTask({ id: 3, title: 'Middle task', userId: 2, completed: false, priority: 'medium' }),
  new PriorityTask({ id: 4, title: 'Book flight', userId: 2, completed: true, priority: 'high' }),
];

describe('filterByStatus()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('returns only completed tasks when status is "completed"', () => {
    const result = filterByStatus(tasks, 'completed');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.completed)).toBe(true);
  });

  it('returns only pending tasks when status is "pending"', () => {
    const result = filterByStatus(tasks, 'pending');
    expect(result).toHaveLength(2);
    expect(result.every((t) => !t.completed)).toBe(true);
  });

  it('returns a copy of everything when status is "all" (the default)', () => {
    const result = filterByStatus(tasks);
    expect(result).toEqual(tasks);
    expect(result).not.toBe(tasks); // must be a new array
  });

  it('returns an empty array for an empty input list', () => {
    expect(filterByStatus([], 'completed')).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const before = [...tasks];
    filterByStatus(tasks, 'completed');
    expect(tasks).toEqual(before);
  });
});

describe('filterByUser()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('returns only the tasks belonging to the given user', () => {
    const result = filterByUser(tasks, 1);
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.userId === 1)).toBe(true);
  });

  it('returns an empty array when no task matches that user', () => {
    expect(filterByUser(tasks, 999)).toEqual([]);
  });

  it('returns an empty array for an empty input list', () => {
    expect(filterByUser([], 1)).toEqual([]);
  });
});

describe('filterByPriority()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('returns only tasks with the given priority', () => {
    const result = filterByPriority(tasks, 'high');
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.priority === 'high')).toBe(true);
  });

  it('returns an empty array when no task matches that priority', () => {
    expect(filterByPriority(tasks, 'critical')).toEqual([]);
  });
});

describe('searchTasks()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('finds a task via a case-insensitive partial title match', () => {
    const result = searchTasks(tasks, 'ALPHA');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Alpha task');
  });

  it('returns a copy of everything when the query is empty', () => {
    expect(searchTasks(tasks, '')).toEqual(tasks);
  });

  it('returns a copy of everything when no query argument is given at all', () => {
    expect(searchTasks(tasks)).toEqual(tasks);
  });

  it('trims whitespace from the query before matching', () => {
    const result = searchTasks(tasks, '   book   ');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Book flight');
  });

  it('returns an empty array when nothing matches', () => {
    expect(searchTasks(tasks, 'nonexistent-term')).toEqual([]);
  });

  it('returns an empty array for an empty input list', () => {
    expect(searchTasks([], 'anything')).toEqual([]);
  });
});

describe('calculateStatistics()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('calculates correct totals for a normal mixed list', () => {
    const stats = calculateStatistics(tasks);
    expect(stats.total).toBe(4);
    expect(stats.completed).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.completionRate).toBe(50);
  });

  it('returns a correct byPriority breakdown', () => {
    const stats = calculateStatistics(tasks);
    expect(stats.byPriority).toEqual({ low: 1, high: 2, medium: 1 });
  });

  it('counts overdue tasks correctly', () => {
    const withOverdue = [
      ...tasks,
      new PriorityTask({ id: 5, title: 'Overdue task', priority: 'high', dueDate: '2020-01-01' }),
    ];
    expect(calculateStatistics(withOverdue).overdueCount).toBe(1);
  });

  it('returns all zeros/empties for an empty array (no divide-by-zero crash)', () => {
    const stats = calculateStatistics([]);
    expect(stats).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      completionRate: 0,
      byPriority: {},
      overdueCount: 0,
    });
  });

  it('does not count overdue for plain Task objects without isOverdue support returning true', () => {
    // plain objects with no isOverdue function should be safely skipped, not crash
    const plainItems = [{ id: 99, completed: false, priority: 'low' }];
    expect(() => calculateStatistics(plainItems)).not.toThrow();
    expect(calculateStatistics(plainItems).overdueCount).toBe(0);
  });

  it('buckets tasks with no priority field at all under "none"', () => {
    const noPriority = [{ id: 1, completed: false }, { id: 2, completed: true }];
    const stats = calculateStatistics(noPriority);
    expect(stats.byPriority).toEqual({ none: 2 });
  });
});

describe('groupByUser()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('groups tasks correctly under each userId key', () => {
    const grouped = groupByUser(tasks);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(2);
  });

  it('returns a real Map instance', () => {
    expect(groupByUser(tasks)).toBeInstanceOf(Map);
  });

  it('returns an empty Map for an empty task list', () => {
    const grouped = groupByUser([]);
    expect(grouped.size).toBe(0);
  });
});

describe('extractUniquePriorities()', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('returns the distinct set of priorities present', () => {
    const priorities = extractUniquePriorities(tasks);
    expect(priorities).toBeInstanceOf(Set);
    expect([...priorities].sort()).toEqual(['high', 'low', 'medium']);
  });

  it('excludes falsy/missing priority values', () => {
    const mixed = [...tasks, { id: 10, priority: undefined }];
    const priorities = extractUniquePriorities(mixed);
    expect(priorities.has(undefined)).toBe(false);
  });

  it('returns an empty Set for an empty task list', () => {
    expect(extractUniquePriorities([]).size).toBe(0);
  });
});

describe('sortTasks() and comparators', () => {
  let tasks;
  beforeEach(() => {
    tasks = buildTasks();
  });

  it('sorts by priority descending using byPriorityDesc', () => {
    const sorted = sortTasks(tasks, byPriorityDesc);
    expect(sorted[0].priority).toBe('high');
    expect(sorted[sorted.length - 1].priority).toBe('low');
  });

  it('sorts alphabetically by title using byTitleAsc', () => {
    const sorted = sortTasks(tasks, byTitleAsc);
    expect(sorted[0].title).toBe('Alpha task');
    expect(sorted[sorted.length - 1].title).toBe('Zebra task');
  });

  it('puts pending tasks first using byCompletedFirst', () => {
    const sorted = sortTasks(tasks, byCompletedFirst);
    expect(sorted[0].completed).toBe(false);
    expect(sorted[sorted.length - 1].completed).toBe(true);
  });

  it('applies multiple comparators in order (priority, then title as tiebreaker)', () => {
    const sorted = sortTasks(tasks, byPriorityDesc, byTitleAsc);
    // Both id 2 ("Alpha task") and id 4 ("Book flight") are "high" priority;
    // the title tiebreaker should put Alpha before Book.
    const highPriorityTitles = sorted.filter((t) => t.priority === 'high').map((t) => t.title);
    expect(highPriorityTitles).toEqual(['Alpha task', 'Book flight']);
  });

  it('does not mutate the original array', () => {
    const before = [...tasks];
    sortTasks(tasks, byTitleAsc);
    expect(tasks).toEqual(before);
  });

  it('returns an empty array when given an empty array', () => {
    expect(sortTasks([], byTitleAsc)).toEqual([]);
  });

  it('returns items unchanged in relative order when given no comparators at all', () => {
    const sorted = sortTasks(tasks);
    expect(sorted.map((t) => t.id)).toEqual(tasks.map((t) => t.id));
  });

  it('byPriorityDesc treats plain objects with no priorityWeight getter as weight 0', () => {
    const plainA = { title: 'Plain A' };
    const plainB = { title: 'Plain B' };
    expect(byPriorityDesc(plainA, plainB)).toBe(0);
  });

  it('byCompletedFirst orders a completed item after a pending one', () => {
    expect(byCompletedFirst({ completed: false }, { completed: true })).toBeLessThan(0);
  });
});
