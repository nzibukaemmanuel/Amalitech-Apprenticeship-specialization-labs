// ui.js
// Pure(ish) DOM rendering. These functions take data in and paint the DOM;
// they never touch storage or the notes array directly.

const notesListEl = document.getElementById('notes-list');
const emptyState = document.getElementById('empty-state');
const emptyBody = document.getElementById('empty-body');
const itemTemplate = document.getElementById('note-item-template');
const tagListEl = document.getElementById('tag-list');
const categoryListEl = document.getElementById('category-list');
const feedbackEl = document.getElementById('feedback');

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlight `query` inside `text`, returning a document fragment. */
const highlightText = (text, query) => {
  const fragment = document.createDocumentFragment();
  if (!query) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }
  const re = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(re);
  parts.forEach((part) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      fragment.appendChild(mark);
    } else if (part) {
      fragment.appendChild(document.createTextNode(part));
    }
  });
  return fragment;
};

/** Build a single note list item from the <template>. */
export const renderNoteItem = (note, { highlight = '', selected = false } = {}) => {
  const el = itemTemplate.content.firstElementChild.cloneNode(true);
  el.dataset.id = note.id;
  el.classList.toggle('is-selected', selected);
  el.classList.toggle('is-archived', Boolean(note.archived));
  el.setAttribute('aria-selected', String(selected));
  el.setAttribute('draggable', 'true');

  const categoryEl = el.querySelector('.note-item-category');
  if (categoryEl) categoryEl.textContent = note.category && note.category !== 'Uncategorized' ? note.category : '';

  const titleEl = el.querySelector('.note-item-title');
  titleEl.textContent = '';
  titleEl.appendChild(highlightText(note.title, highlight));

  const tagsEl = el.querySelector('.note-tags');
  tagsEl.innerHTML = '';
  note.tags.forEach((tag) => {
    const li = document.createElement('li');
    li.className = 'note-tag';
    li.textContent = tag;
    tagsEl.appendChild(li);
  });

  const dateEl = el.querySelector('.note-item-date');
  dateEl.textContent = formatDate(note.updatedAt || note.createdAt);
  dateEl.setAttribute('datetime', note.updatedAt || note.createdAt);

  return el;
};

/**
 * Render the full note list. `meta` controls the empty-state copy, the
 * highlight term, and which note (if any) is marked as selected.
 */
const MAX_VISIBLE_NOTES = 7;

export const renderNotesList = (notes, meta = {}) => {
  const { highlight = '', emptyMessage, selectedId = null } = meta;
  notesListEl.innerHTML = '';
  notesListEl.classList.remove('is-scrollable');
  notesListEl.style.maxHeight = '';

  if (notes.length === 0) {
    emptyState.hidden = false;
    if (emptyMessage) emptyBody.textContent = emptyMessage;
    return;
  }

  emptyState.hidden = true;
  const fragment = document.createDocumentFragment();
  notes.forEach((note) =>
    fragment.appendChild(renderNoteItem(note, { highlight, selected: note.id === selectedId }))
  );
  notesListEl.appendChild(fragment);

  if (notes.length > MAX_VISIBLE_NOTES) {
    const cutoffItem = notesListEl.children[MAX_VISIBLE_NOTES];
    notesListEl.style.maxHeight = `${cutoffItem.offsetTop}px`;
    notesListEl.classList.add('is-scrollable');
  }
};

/** Render the tag sidebar list; `activeTag` gets the active style. */
export const updateTagList = (tags, activeTag = null) => {
  tagListEl.innerHTML = '';
  if (tags.length === 0) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = 'Tags you add to notes will show up here.';
    tagListEl.appendChild(li);
    return;
  }

  tags.forEach((tag) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tag-chip';
    btn.dataset.tag = tag;
    if (tag === activeTag) btn.classList.add('is-active');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-tag');
    icon.appendChild(use);

    const name = document.createElement('span');
    name.className = 'tag-name';
    name.textContent = tag;

    btn.append(icon, name);
    li.appendChild(btn);
    tagListEl.appendChild(li);
  });
};

/** Render the category sidebar list; `activeCategory` gets the active style. */
export const updateCategoryList = (categories, activeCategory = null) => {
  if (!categoryListEl) return;
  categoryListEl.innerHTML = '';

  categories.forEach((category) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'category-chip';
    btn.dataset.category = category;
    if (category === activeCategory) btn.classList.add('is-active');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-category');
    icon.appendChild(use);

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = category;

    btn.append(icon, name);
    li.appendChild(btn);
    categoryListEl.appendChild(li);
  });
};

/** Show (or clear) a validation error under a form field. */
export const showValidationError = (fieldId, message) => {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId.replace('note-', '')}-error`);
  if (input) input.classList.toggle('is-invalid', Boolean(message));
  if (errorEl) errorEl.textContent = message || '';
};

let toastTimeout = null;
export const showFeedback = (message, { type = 'info', duration = 3200 } = {}) => {
  feedbackEl.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  toast.textContent = message;
  feedbackEl.appendChild(toast);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    feedbackEl.innerHTML = '';
  }, duration);
};

export const toggleArchiveView = (isArchivedView) => {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    const match = btn.dataset.filter === (isArchivedView ? 'archived' : 'all');
    btn.classList.toggle('is-active', match);
  });
};
