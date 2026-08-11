import './style.css';
import { resources, type DevResource } from './resources';

const categories = [
  'All',
  ...Array.from(new Set(resources.map((r) => r.category))).sort(),
];

let activeCategory = 'All';
let query = '';

const app = document.querySelector<HTMLElement>('#app')!;

app.innerHTML = `
  <header class="dashboard-header">
    <h1>Developer Dashboard</h1>
    <p>Curated tutorials, docs, and tools for everyday development.</p>
  </header>

  <section class="controls">
    <input id="search" type="search" placeholder="Search resources..." aria-label="Search resources" />
    <div id="filters" class="filters" role="group" aria-label="Filter by category"></div>
  </section>

  <p class="count" id="count"></p>
  <section id="results"></section>
`;

const filtersEl = document.querySelector<HTMLDivElement>('#filters')!;
const resultsEl = document.querySelector<HTMLDivElement>('#results')!;
const countEl = document.querySelector<HTMLParagraphElement>('#count')!;
const searchInput = document.querySelector<HTMLInputElement>('#search')!;

function filteredResources(): DevResource[] {
  const q = query.trim().toLowerCase();
  return resources.filter((r) => {
    const matchesCategory =
      activeCategory === 'All' || r.category === activeCategory;
    const matchesQuery =
      q === '' ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });
}

function renderCards(list: DevResource[]): string {
  if (list.length === 0) {
    return `<p class="empty">No resources match your search.</p>`;
  }
  return `
    <div class="grid">
      ${list
        .map(
          (r) => `
        <a class="card" href="${r.link}" target="_blank" rel="noopener noreferrer">
          <span class="badge">${r.category}</span>
          <h2>${r.name}</h2>
          <p>${r.description}</p>
        </a>
      `
        )
        .join('')}
    </div>
  `;
}

function render(): void {
  const list = filteredResources();
  resultsEl.innerHTML = renderCards(list);
  countEl.textContent = `${list.length} resource${list.length === 1 ? '' : 's'}`;
}

filtersEl.innerHTML = categories
  .map(
    (c) =>
      `<button type="button" class="chip${c === activeCategory ? ' active' : ''}" data-category="${c}">${c}</button>`
  )
  .join('');

filtersEl.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const category = target.dataset.category;
  if (!category) return;
  activeCategory = category;
  filtersEl
    .querySelectorAll('.chip')
    .forEach((chip) => chip.classList.toggle('active', chip === target));
  render();
});

searchInput.addEventListener('input', () => {
  query = searchInput.value;
  render();
});

render();
