// Browser entry point — reuses the exact same TaskManager/taskProcessor
// modules the Node CLI uses (src/main.js). No bundler, no framework: plain
// ES modules loaded directly by the browser, served by server.js.
import { TaskManager } from './src/taskManager.js';
import * as processor from './src/taskProcessor.js';

const manager = new TaskManager();

const $ = (id) => document.getElementById(id);
const searchInput = $('search-input');
const sortSelect = $('sort-select');
const userNav = $('user-nav');
const statusTabs = $('status-tabs');

const SORTERS = {
  none: [],
  priority: [processor.byPriorityDesc, processor.byTitleAsc],
  title: [processor.byTitleAsc],
  completed: [processor.byCompletedFirst]
};

// UI-only filter state — replaces the old <select> elements with a sidebar
// user list and a row of status tabs, both driven from plain variables.
const state = {
  status: 'all',
  userId: 'all'
};

function setStatus(message, isError = false) {
  const el = $('status');
  el.textContent = message;
  el.classList.toggle('is-error', isError);
}

function initials(name = '') {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function renderStats() {
  const { total, completed, pending, completionRate, overdueCount, byPriority } = manager.getStatistics();
  $('stats-grid').innerHTML = [
    ['Total', total],
    ['Completed', completed],
    ['Pending', pending],
    ['Completion', `${completionRate}%`],
    ['Overdue', overdueCount]
  ].map(([label, value]) => `
    <div class="stat">
      <div class="value">${value}</div>
      <div class="label">${label}</div>
    </div>
  `).join('');

  $('priority-breakdown').textContent =
    `By priority — ${Object.entries(byPriority).map(([k, v]) => `${k}: ${v}`).join(', ')}`;
}

function renderUserNav() {
  const users = manager.getUserList();
  const allCount = manager.tasks.length;

  const allItem = `
    <button class="user-item ${state.userId === 'all' ? 'active' : ''}" data-user="all">
      <span class="avatar">All</span>
      <span class="user-name">All users</span>
      <span class="user-count">${allCount}</span>
    </button>
  `;

  const userItems = users.map((user) => `
    <button class="user-item ${String(state.userId) === String(user.id) ? 'active' : ''}" data-user="${user.id}">
      <span class="avatar">${initials(user.name)}</span>
      <span class="user-name">${user.name}</span>
      <span class="user-count">${user.tasks.length}</span>
    </button>
  `).join('');

  userNav.innerHTML = allItem + userItems;
}

function statusBadge(task) {
  if (task.completed) return { cls: 'status-completed', label: 'Completed' };
  if (typeof task.isOverdue === 'function' && task.isOverdue()) return { cls: 'status-overdue', label: 'Overdue' };
  return { cls: 'status-pending', label: 'Pending' };
}

function renderTasks(tasks) {
  $('task-count').textContent = `${tasks.length} task(s)`;
  $('task-rows').innerHTML = tasks.map((task) => {
    const user = manager.users.get(task.userId);
    const { cls, label } = statusBadge(task);
    const isOverdue = cls === 'status-overdue';
    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
    return `
      <article class="task-card ${task.completed ? 'is-completed' : ''} ${isOverdue ? 'is-overdue' : ''}" data-id="${task.id}">
        <div class="task-main">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span>${user?.name ?? `User ${task.userId}`}</span>
            <span>${task.priority} priority</span>
            <span>Due ${due}</span>
          </div>
        </div>
        <div class="task-side">
          <span class="status-badge ${cls}">${label}</span>
          <button class="toggle-btn" data-id="${task.id}">Toggle</button>
        </div>
      </article>
    `;
  }).join('');
}

function applyFilters() {
  let tasks = processor.filterByStatus(manager.tasks, state.status);
  if (state.userId !== 'all') {
    tasks = processor.filterByUser(tasks, Number(state.userId));
  }
  tasks = processor.searchTasks(tasks, searchInput.value);
  tasks = processor.sortTasks(tasks, ...SORTERS[sortSelect.value]);
  renderTasks(tasks);
}

function downloadJSON(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadData() {
  setStatus('Loading users and todos from JSONPlaceholder…');
  try {
    await manager.load();
    renderUserNav();
    renderStats();
    applyFilters();
    setStatus(`Loaded ${manager.getUserList().length} users and ${manager.tasks.length} tasks.`);
  } catch (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
  }
}

searchInput.addEventListener('input', applyFilters);
sortSelect.addEventListener('input', applyFilters);

statusTabs.addEventListener('click', (event) => {
  const tab = event.target.closest('.tab');
  if (!tab) return;
  state.status = tab.dataset.status;
  [...statusTabs.querySelectorAll('.tab')].forEach((el) => el.classList.toggle('active', el === tab));
  applyFilters();
});

userNav.addEventListener('click', (event) => {
  const item = event.target.closest('.user-item');
  if (!item) return;
  state.userId = item.dataset.user;
  renderUserNav();
  applyFilters();
});

$('reload-btn').addEventListener('click', loadData);

$('task-rows').addEventListener('click', (event) => {
  const button = event.target.closest('.toggle-btn');
  if (!button) return;
  const task = manager.tasks.find((t) => t.id === Number(button.dataset.id));
  task?.toggle();
  renderUserNav();
  renderStats();
  applyFilters();
});

$('export-btn').addEventListener('click', () => {
  const payload = {
    exportedAt: new Date().toISOString(),
    statistics: manager.getStatistics(),
    users: manager.getUserList(),
    tasks: manager.tasks
  };
  downloadJSON(payload, 'task-export.json');
  $('export-output').textContent = `Exported ${manager.tasks.length} tasks and ${manager.getUserList().length} users.`;
});

$('rate-limit-btn').addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  const output = $('rate-limit-output');
  button.disabled = true;
  output.textContent = 'Fetching todos per user with concurrency capped at 3…';

  try {
    const start = performance.now();
    const todosByUser = await manager.fetchTodosPerUser({ concurrency: 3 });
    const elapsed = Math.round(performance.now() - start);
    const lines = [...todosByUser].map(([userId, todos]) => `User ${userId}: ${todos.length} todo(s)`);
    output.textContent = `${lines.join('\n')}\n\nDone in ${elapsed}ms (served from cache after the first run).`;
  } catch (error) {
    output.textContent = `Failed: ${error.message}`;
  } finally {
    button.disabled = false;
  }
});

loadData();
