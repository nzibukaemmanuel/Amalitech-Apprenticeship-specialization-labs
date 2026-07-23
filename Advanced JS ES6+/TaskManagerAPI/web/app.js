// Browser entry point — reuses the exact same TaskManager/taskProcessor
// modules the Node CLI uses (src/main.js). No bundler, no framework: plain
// ES modules loaded directly by the browser, served by ../server.js.
import { TaskManager } from '../src/taskManager.js';
import * as processor from '../src/taskProcessor.js';

const manager = new TaskManager();

const $ = (id) => document.getElementById(id);
const searchInput = $('search-input');
const statusFilter = $('status-filter');
const userFilter = $('user-filter');
const sortSelect = $('sort-select');

const SORTERS = {
  none: [],
  priority: [processor.byPriorityDesc, processor.byTitleAsc],
  title: [processor.byTitleAsc],
  completed: [processor.byCompletedFirst]
};

function setStatus(message, isError = false) {
  const el = $('status');
  el.textContent = message;
  el.style.color = isError ? 'var(--overdue)' : '';
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

function populateUserFilter() {
  const options = manager.getUserList()
    .map(({ id, name }) => `<option value="${id}">${name}</option>`)
    .join('');
  userFilter.innerHTML = `<option value="all">All users</option>${options}`;
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
    const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—';
    return `
      <tr data-id="${task.id}">
        <td>${task.id}</td>
        <td>${task.title}</td>
        <td>${user?.name ?? task.userId}</td>
        <td>${task.priority}</td>
        <td><span class="status-badge ${cls}">${label}</span></td>
        <td>${due}</td>
        <td class="row-actions"><button class="secondary toggle-btn" data-id="${task.id}">Toggle</button></td>
      </tr>
    `;
  }).join('');
}

function applyFilters() {
  let tasks = processor.filterByStatus(manager.tasks, statusFilter.value);
  if (userFilter.value !== 'all') {
    tasks = processor.filterByUser(tasks, Number(userFilter.value));
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
    populateUserFilter();
    renderStats();
    applyFilters();
    setStatus(`Loaded ${manager.getUserList().length} users and ${manager.tasks.length} tasks.`);
  } catch (error) {
    setStatus(`Failed to load data: ${error.message}`, true);
  }
}

[searchInput, statusFilter, userFilter, sortSelect].forEach((el) =>
  el.addEventListener('input', applyFilters)
);

$('reload-btn').addEventListener('click', loadData);

$('task-rows').addEventListener('click', (event) => {
  const button = event.target.closest('.toggle-btn');
  if (!button) return;
  const task = manager.tasks.find((t) => t.id === Number(button.dataset.id));
  task?.toggle();
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
  const button = event.target;
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
