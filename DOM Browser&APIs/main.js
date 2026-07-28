// main.js
// Wires the modules together: owns UI state (current filter/tag/search/selected
// note), attaches event listeners (mostly via delegation), and re-renders
// after every change.

import * as storage from './storage.js';
import * as noteManager from './noteManager.js';
import * as ui from './ui.js';
import * as themes from './themes.js';

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------

const searchInput = document.getElementById('search-input');
const notesListEl = document.getElementById('notes-list');
const tagListEl = document.getElementById('tag-list');
const sidebar = document.getElementById('sidebar');
const sidebarScrim = document.getElementById('sidebar-scrim');
const menuToggle = document.getElementById('menu-toggle');
const filterButtons = document.querySelectorAll('.filter-btn');

const newNoteBtn = document.getElementById('new-note-btn');
const noteForm = document.getElementById('note-form');
const emptyDetail = document.getElementById('empty-detail');
const saveBtn = document.getElementById('save-btn');
const cancelBtn = document.getElementById('cancel-btn');

const noteIdInput = document.getElementById('note-id');
const noteTitleInput = document.getElementById('note-title');
const noteContentInput = document.getElementById('note-content');
const noteTagsInput = document.getElementById('note-tags');
const lastEditedRow = document.getElementById('last-edited-row');
const lastEditedEl = document.getElementById('note-last-edited');

const addLocationBtn = document.getElementById('add-location-btn');
const locationDisplay = document.getElementById('location-display');

const actionsPanel = document.getElementById('actions-panel');
const archiveNoteBtn = document.getElementById('archive-note-btn');
const archiveNoteLabel = document.getElementById('archive-note-label');
const deleteNoteBtn = document.getElementById('delete-note-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const confirmBodyText = document.getElementById('confirm-body-text');

const settingsBtn = document.getElementById('settings-btn');
const settingsPopover = document.getElementById('settings-popover');
const settingsPanels = document.querySelectorAll('.settings-panel');
const themeSelect = document.getElementById('theme-select');
const fontSelect = document.getElementById('font-select');
const changePasswordBtn = document.getElementById('change-password-btn');
const logoutBtn = document.getElementById('logout-btn');

const viewTitle = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const state = {
  filter: 'all',        // 'all' | 'archived'
  tag: null,             // string | null
  search: '',
  selectedId: null,      // note id currently shown in the detail panel
  isCreating: false,     // true while composing a brand-new (unsaved) note
  pendingLocation: null,
  pendingDeleteId: null,
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function getVisibleNotes() {
  let list = noteManager.filterByArchived(state.filter === 'archived');
  if (state.tag) list = noteManager.filterByTag(state.tag, list);
  if (state.search) list = noteManager.searchNotes(state.search, list);
  return list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function emptyMessage() {
  if (state.search) return `No notes match “${state.search}”.`;
  if (state.tag) return `No notes tagged ${state.tag} yet.`;
  if (state.filter === 'archived') return 'Nothing archived. Notes you archive will land here.';
  return 'Write your first note — it takes less time than finding a pen.';
}

function updateHeader() {
  viewTitle.textContent = state.filter === 'archived' ? 'Archived Notes' : 'All Notes';
  const parts = [];
  if (state.tag) parts.push(`tagged ${state.tag}`);
  if (state.search) parts.push(`matching “${state.search}”`);
  viewSubtitle.textContent = parts.join(' · ');
}

function render() {
  const visible = getVisibleNotes();
  ui.renderNotesList(visible, {
    highlight: state.search,
    emptyMessage: emptyMessage(),
    selectedId: state.selectedId,
  });
  ui.updateTagList(noteManager.getAllTags(), state.tag);
  ui.toggleArchiveView(state.filter === 'archived');
  updateHeader();
}

// ---------------------------------------------------------------------------
// Detail panel helpers
// ---------------------------------------------------------------------------

function showForm() {
  noteForm.hidden = false;
  emptyDetail.hidden = true;
}

function closeDetail() {
  state.selectedId = null;
  state.isCreating = false;
  state.pendingLocation = null;
  noteForm.hidden = true;
  emptyDetail.hidden = false;
  actionsPanel.hidden = true;
  noteForm.reset();
  ui.showValidationError('note-title', '');
  render();
}

function fillFormFrom(note) {
  noteIdInput.value = note.id;
  noteTitleInput.value = note.title;
  noteContentInput.value = note.content;
  noteTagsInput.value = note.tags.join(', ');
  lastEditedRow.hidden = false;
  lastEditedEl.textContent = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  locationDisplay.textContent = note.location
    ? `📍 ${note.location.city || `${note.location.lat.toFixed(2)}, ${note.location.lng.toFixed(2)}`}`
    : '';
  ui.showValidationError('note-title', '');
  saveBtn.disabled = false;
}

function setArchiveButtonLabel(archived) {
  archiveNoteLabel.textContent = archived ? 'Unarchive Note' : 'Archive Note';
}

function selectNote(note) {
  state.selectedId = note.id;
  state.isCreating = false;
  state.pendingLocation = note.location || null;
  fillFormFrom(note);
  setArchiveButtonLabel(note.archived);
  showForm();
  actionsPanel.hidden = false;
  render();
}

function openCreate() {
  state.selectedId = null;
  state.isCreating = true;
  state.pendingLocation = null;

  noteForm.reset();
  noteIdInput.value = '';
  lastEditedRow.hidden = true;
  locationDisplay.textContent = '';
  ui.showValidationError('note-title', '');
  saveBtn.disabled = true;

  restoreDraftIfAny();
  showForm();
  actionsPanel.hidden = true;
  render();
  noteTitleInput.focus();
}

// ---------------------------------------------------------------------------
// Validation + drafts
// ---------------------------------------------------------------------------

function isTitleValid() {
  return noteTitleInput.value.trim().length >= 3;
}

function validateTitle({ showError = true } = {}) {
  const value = noteTitleInput.value.trim();
  if (value.length === 0) {
    if (showError) ui.showValidationError('note-title', 'Title is required.');
    return false;
  }
  if (value.length < 3) {
    if (showError) ui.showValidationError('note-title', 'Title needs at least 3 characters.');
    return false;
  }
  ui.showValidationError('note-title', '');
  return true;
}

noteTitleInput.addEventListener('input', () => {
  saveBtn.disabled = !isTitleValid();
  if (noteTitleInput.classList.contains('is-invalid')) validateTitle();
  autosaveDraft();
});
noteTitleInput.addEventListener('blur', () => validateTitle());

let draftTimeout = null;
function autosaveDraft() {
  if (!state.isCreating) return; // only draft new notes, edits are already persisted
  clearTimeout(draftTimeout);
  draftTimeout = setTimeout(() => {
    const draft = {
      title: noteTitleInput.value,
      content: noteContentInput.value,
      tags: noteTagsInput.value,
    };
    if (draft.title || draft.content || draft.tags) {
      storage.saveDraft(draft);
    }
  }, 300);
}
noteContentInput.addEventListener('input', autosaveDraft);
noteTagsInput.addEventListener('input', autosaveDraft);

function restoreDraftIfAny() {
  const draft = storage.loadDraft();
  if (!draft) return;
  noteTitleInput.value = draft.title || '';
  noteContentInput.value = draft.content || '';
  noteTagsInput.value = draft.tags || '';
  saveBtn.disabled = !isTitleValid();
  if (draft.title || draft.content) {
    ui.showFeedback('Restored your unsaved draft.');
  }
}

// ---------------------------------------------------------------------------
// Form submit (create / update) + cancel
// ---------------------------------------------------------------------------

noteForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateTitle()) {
    noteTitleInput.focus();
    return;
  }

  const title = noteTitleInput.value.trim();
  const content = noteContentInput.value.trim();
  const tags = noteTagsInput.value;

  if (state.isCreating) {
    const note = noteManager.createNote(title, content, tags);
    if (state.pendingLocation) {
      noteManager.updateNote(note.id, { location: state.pendingLocation });
    }
    storage.clearDraft();
    ui.showFeedback('Note saved.');
    selectNote(noteManager.getNotes().find((n) => n.id === note.id));
  } else if (state.selectedId) {
    noteManager.updateNote(state.selectedId, { title, content, tags, location: state.pendingLocation });
    ui.showFeedback('Note updated.');
    selectNote(noteManager.getNotes().find((n) => n.id === state.selectedId));
  }
});

newNoteBtn.addEventListener('click', openCreate);

cancelBtn.addEventListener('click', () => {
  if (state.isCreating) {
    storage.clearDraft();
    closeDetail();
    return;
  }
  if (state.selectedId) {
    const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
    if (note) {
      fillFormFrom(note);
      state.pendingLocation = note.location || null;
      ui.showFeedback('Changes discarded.');
    }
  }
});

// ---------------------------------------------------------------------------
// Geolocation (bonus browser API)
// ---------------------------------------------------------------------------

addLocationBtn.addEventListener('click', () => {
  if (!('geolocation' in navigator)) {
    locationDisplay.textContent = 'Geolocation is not supported on this device.';
    return;
  }
  locationDisplay.textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude: lat, longitude: lng } = position.coords;
      let city = null;
      try {
        const res = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        if (res.ok) {
          const data = await res.json();
          city = data.city || data.locality || null;
        }
      } catch {
        // Reverse geocoding is a nice-to-have; coordinates alone are fine.
      }
      state.pendingLocation = { lat, lng, city };
      locationDisplay.textContent = `📍 ${city || `${lat.toFixed(2)}, ${lng.toFixed(2)}`}`;
    },
    (error) => {
      state.pendingLocation = null;
      locationDisplay.textContent =
        error.code === error.PERMISSION_DENIED
          ? 'Location permission denied.'
          : 'Could not get your location.';
    },
    { timeout: 8000 }
  );
});

// ---------------------------------------------------------------------------
// Note list selection
// ---------------------------------------------------------------------------

notesListEl.addEventListener('click', (e) => {
  const item = e.target.closest('.note-item');
  if (!item) return;
  const note = noteManager.getNotes().find((n) => n.id === item.dataset.id);
  if (note) selectNote(note);
});

notesListEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const item = e.target.closest('.note-item');
  if (!item) return;
  e.preventDefault();
  const note = noteManager.getNotes().find((n) => n.id === item.dataset.id);
  if (note) selectNote(note);
});

// ---------------------------------------------------------------------------
// Actions panel: archive / delete the currently selected note
// ---------------------------------------------------------------------------

archiveNoteBtn.addEventListener('click', () => {
  if (!state.selectedId) return;
  const updated = noteManager.toggleArchive(state.selectedId);
  ui.showFeedback(updated.archived ? 'Note archived.' : 'Note unarchived.');
  selectNote(updated);
});

deleteNoteBtn.addEventListener('click', () => {
  if (!state.selectedId) return;
  const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
  if (note) openDeleteConfirm(note);
});

function openDeleteConfirm(note) {
  state.pendingDeleteId = note.id;
  confirmBodyText.textContent = `“${note.title}” will be permanently deleted. This can't be undone.`;
  confirmModal.showModal();
  confirmDeleteBtn.focus();
}

confirmCancelBtn.addEventListener('click', () => confirmModal.close());
confirmDeleteBtn.addEventListener('click', () => {
  if (state.pendingDeleteId) {
    noteManager.deleteNote(state.pendingDeleteId);
    ui.showFeedback('Note deleted.');
    confirmModal.close();
    closeDetail();
  }
});
confirmModal.addEventListener('close', () => {
  state.pendingDeleteId = null;
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

let searchTimeout = null;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = searchInput.value.trim();
    render();
  }, 150);
});
document.getElementById('search-form').addEventListener('submit', (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// Sidebar: view filter (all / archived) + tag filter
// ---------------------------------------------------------------------------

filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.filter = btn.dataset.filter;
    render();
    closeSidebarOnMobile();
  });
});

tagListEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.tag-chip');
  if (!chip) return;
  const tag = chip.dataset.tag;
  state.tag = state.tag === tag ? null : tag;
  render();
  closeSidebarOnMobile();
});

// ---------------------------------------------------------------------------
// Mobile sidebar toggle
// ---------------------------------------------------------------------------

function openSidebarOnMobile() {
  sidebar.classList.add('is-open');
  sidebarScrim.hidden = false;
  requestAnimationFrame(() => sidebarScrim.classList.add('is-visible'));
  menuToggle.setAttribute('aria-expanded', 'true');
}
function closeSidebarOnMobile() {
  sidebar.classList.remove('is-open');
  sidebarScrim.classList.remove('is-visible');
  sidebarScrim.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
}
menuToggle.addEventListener('click', () => {
  const isOpen = sidebar.classList.contains('is-open');
  isOpen ? closeSidebarOnMobile() : openSidebarOnMobile();
});
sidebarScrim.addEventListener('click', closeSidebarOnMobile);

// ---------------------------------------------------------------------------
// Settings popover (theme + font)
// ---------------------------------------------------------------------------

function showSettingsPanel(name) {
  settingsPanels.forEach((panel) => {
    panel.hidden = panel.id !== `settings-panel-${name}`;
  });
}

function openSettingsPopover() {
  settingsPopover.hidden = false;
  showSettingsPanel('root');
  settingsBtn.setAttribute('aria-expanded', 'true');
}
function closeSettingsPopover() {
  settingsPopover.hidden = true;
  settingsBtn.setAttribute('aria-expanded', 'false');
}
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  settingsPopover.hidden ? openSettingsPopover() : closeSettingsPopover();
});
document.addEventListener('click', (e) => {
  if (!settingsPopover.hidden && !settingsPopover.contains(e.target) && e.target !== settingsBtn) {
    closeSettingsPopover();
  }
});

settingsPopover.addEventListener('click', (e) => {
  const openBtn = e.target.closest('[data-open-panel]');
  if (openBtn) {
    showSettingsPanel(openBtn.dataset.openPanel);
    return;
  }
  if (e.target.closest('[data-close-panel]')) {
    showSettingsPanel('root');
  }
});

changePasswordBtn.addEventListener('click', () => {
  ui.showFeedback("Password changes aren't available in this demo.");
  closeSettingsPopover();
});

logoutBtn.addEventListener('click', () => {
  ui.showFeedback("Logout isn't available in this demo.");
  closeSettingsPopover();
});

// ---------------------------------------------------------------------------
// Keyboard: Escape closes whichever overlay is open.
// ---------------------------------------------------------------------------

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (sidebar.classList.contains('is-open')) closeSidebarOnMobile();
  if (!settingsPopover.hidden) closeSettingsPopover();
});

// ---------------------------------------------------------------------------
// Theme & font controls (segmented icon buttons)
// ---------------------------------------------------------------------------

function setActiveSegment(container, value) {
  container.querySelectorAll('.settings-option').forEach((btn) => {
    const active = btn.dataset.value === value;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

themeSelect.addEventListener('click', (e) => {
  const btn = e.target.closest('.settings-option');
  if (!btn) return;
  themes.applyTheme(btn.dataset.value);
  setActiveSegment(themeSelect, btn.dataset.value);
});

fontSelect.addEventListener('click', (e) => {
  const btn = e.target.closest('.settings-option');
  if (!btn) return;
  themes.applyFont(btn.dataset.value);
  setActiveSegment(fontSelect, btn.dataset.value);
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

function init() {
  document.getElementById('storage-warning').hidden = storage.isStorageAvailable();

  const prefs = themes.applySavedPreferences();
  setActiveSegment(themeSelect, prefs.theme);
  setActiveSegment(fontSelect, prefs.font);
  noteManager.init();
  render();

  // If a draft exists from a previous session, let the user know they can
  // resume it via "+ Create New Note".
  const draft = storage.loadDraft();
  if (draft && (draft.title || draft.content)) {
    ui.showFeedback('You have an unsaved draft — open “+ Create New Note” to resume it.');
  }
}

init();
