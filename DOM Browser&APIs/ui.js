// ui.js
// Pure(ish) DOM rendering. These functions take data in and paint the DOM;
// they never touch storage or the notes array directly.

const notesListEl = document.getElementById('notes-list');
const emptyState = document.getElementById('empty-state');
const emptyBody = document.getElementById('empty-body');
const itemTemplate = document.getElementById('note-item-template');
const tagListEl = document.getElementById('tag-list');
const folderListEl = document.getElementById('folder-list');
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

// ---------------------------------------------------------------------------
// Markdown (bonus): a small, deliberately limited renderer. It only knows
// about the syntax the note-editor toolbar can insert (bold, italic, links,
// inline code, and bulleted/numbered lists) so there's no ambiguity between
// "what the toolbar writes" and "what gets rendered".  Everything is HTML-
// escaped first, so raw markup a user types is never executed.
// ---------------------------------------------------------------------------

const escapeHtml = (str) => str
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderInlineMarkdown = (line) => escapeHtml(line)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\*([^*]+)\*/g, '<em>$1</em>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

/** Convert the note's plain-text/markdown content into safe HTML for the read-only preview. */
export const renderMarkdown = (text) => {
  const lines = (text || '').split('\n');
  const html = [];
  let listType = null; // 'ul' | 'ol' | null

  const closeList = () => {
    if (listType) { html.push(`</${listType}>`); listType = null; }
  };

  lines.forEach((line) => {
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const numberMatch = /^\s*\d+\.\s+(.*)$/.exec(line);

    if (bulletMatch) {
      if (listType !== 'ul') { closeList(); html.push('<ul>'); listType = 'ul'; }
      html.push(`<li>${renderInlineMarkdown(bulletMatch[1])}</li>`);
    } else if (numberMatch) {
      if (listType !== 'ol') { closeList(); html.push('<ol>'); listType = 'ol'; }
      html.push(`<li>${renderInlineMarkdown(numberMatch[1])}</li>`);
    } else {
      closeList();
      if (line.trim() === '') html.push('<br>');
      else html.push(`<p>${renderInlineMarkdown(line)}</p>`);
    }
  });
  closeList();
  return html.join('');
};

/** Build a single note list item from the <template>. */
export const renderNoteItem = (note, { highlight = '', selected = false } = {}) => {
  const el = itemTemplate.content.firstElementChild.cloneNode(true);
  el.dataset.id = note.id;
  el.classList.toggle('is-selected', selected);
  el.classList.toggle('is-archived', Boolean(note.archived));
  el.setAttribute('aria-selected', String(selected));
  el.setAttribute('draggable', 'true');

  const titleEl = el.querySelector('.note-item-title');
  titleEl.textContent = '';
  titleEl.appendChild(highlightText(note.title, highlight));

  const folderEl = el.querySelector('.note-item-folder');
  if (folderEl) folderEl.textContent = note.folder && note.folder !== 'Uncategorized' ? note.folder : '';

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

/** Render the folder/category sidebar list (bonus); `activeFolder` gets the active style. */
export const updateFolderList = (folders, activeFolder = null) => {
  if (!folderListEl) return;
  folderListEl.innerHTML = '';

  folders.forEach((folder) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'folder-chip';
    btn.dataset.folder = folder;
    btn.dataset.dropTarget = 'folder';
    if (folder === activeFolder) btn.classList.add('is-active');

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-folder');
    icon.appendChild(use);

    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder;

    btn.append(icon, name);
    li.appendChild(btn);
    folderListEl.appendChild(li);
  });
};

/** Show (or clear) a validation error under a form field. */
export const showValidationError = (fieldId, message) => {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId.replace('note-', '')}-error`);
  if (input) input.classList.toggle('is-invalid', Boolean(message));
  if (errorEl) errorEl.textContent = message || '';
};

const makeIcon = (href) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', href);
  svg.appendChild(use);
  return svg;
};

/**
 * Show a toast in the bottom-right stack. Toasts persist independently of
 * one another (each has its own auto-dismiss timer) so several can be
 * visible at once, newest at the bottom of the stack.
 *
 * `action`, if given, renders an underlined link before the close button —
 * e.g. { label: 'Archived Notes', onClick: () => ... } — and dismisses the
 * toast when clicked.
 */
export const showFeedback = (message, { type = 'info', duration = 4000, action } = {}) => {
  if (!feedbackEl) return;

  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  toast.setAttribute('role', 'status');

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.appendChild(makeIcon(type === 'error' ? '#icon-close' : '#icon-check'));

  const messageEl = document.createElement('span');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;

  const dismiss = () => {
    clearTimeout(timeoutId);
    toast.remove();
  };

  toast.append(icon, messageEl);

  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-action';
    actionBtn.textContent = action.label;
    actionBtn.addEventListener('click', () => {
      action.onClick?.();
      dismiss();
    });
    toast.appendChild(actionBtn);
  }

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.appendChild(makeIcon('#icon-close'));
  closeBtn.addEventListener('click', dismiss);
  toast.appendChild(closeBtn);

  feedbackEl.appendChild(toast);
  const timeoutId = setTimeout(dismiss, duration);
};

export const toggleArchiveView = (isArchivedView) => {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    const match = btn.dataset.filter === (isArchivedView ? 'archived' : 'all');
    btn.classList.toggle('is-active', match);
  });
};
