// Pure functions only — none of these mutate their inputs, which makes them
// trivial to test in isolation (see tests/smoke-test.js).

export const filterByStatus = (tasks, status = 'all') => {
  if (status === 'all') return [...tasks];
  const wantCompleted = status === 'completed';
  return tasks.filter(({ completed }) => completed === wantCompleted);
};

export const filterByUser = (tasks, userId) => tasks.filter((t) => t.userId === userId);

export const filterByPriority = (tasks, priority) => tasks.filter((t) => t.priority === priority);

export const searchTasks = (tasks, query = '') => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...tasks];
  return tasks.filter(({ title }) => title?.toLowerCase().includes(needle));
};

export const calculateStatistics = (tasks) => {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = total - completed;
  const completionRate = total ? Number(((completed / total) * 100).toFixed(1)) : 0;

  const byPriority = tasks.reduce((acc, task) => {
    const key = task.priority ?? 'none';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const overdueCount = tasks.filter((t) => typeof t.isOverdue === 'function' && t.isOverdue()).length;

  return { total, completed, pending, completionRate, byPriority, overdueCount };
};

export const groupByUser = (tasks) =>
  tasks.reduce((map, task) => {
    const bucket = map.get(task.userId) ?? [];
    bucket.push(task);
    map.set(task.userId, bucket);
    return map;
  }, new Map());

export const extractUniquePriorities = (tasks) =>
  new Set(tasks.map((t) => t.priority).filter(Boolean));

// Multi-criteria sort (bonus): pass any number of comparators, applied in
// order until one returns non-zero.
export const sortTasks = (tasks, ...comparators) =>
  [...tasks].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });

export const byPriorityDesc = (a, b) => (b.priorityWeight ?? 0) - (a.priorityWeight ?? 0);
export const byTitleAsc = (a, b) => a.title.localeCompare(b.title);
export const byCompletedFirst = (a, b) => Number(a.completed) - Number(b.completed);
