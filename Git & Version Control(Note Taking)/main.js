// main.js
// The one entry script every page in this project loads. It detects which
// page it's running on and only wires up that page — this is why the whole
// project needs just five JS modules (storage.js, noteManager.js, ui.js,
// themes.js, main.js) instead of one file per page.
//
//   - index.html                -> initNotesApp()   (the note-taking app)
//   - login.html                -> initLoginPage()
//   - signup.html                -> initSignupPage()
//   - forgot-password.html      -> initForgotPasswordPage()
//   - reset-password.html       -> initResetPasswordPage()

import * as storage from './storage.js';
import * as noteManager from './noteManager.js';
import * as ui from './ui.js';
import * as themes from './themes.js';

// ============================================================================
// Shared auth helpers
// Small, dependency-free helpers used by every auth-page controller below
// (password hashing, token generation, field errors, a toast, the password
// show/hide toggle). Nothing here touches storage directly — that's
// storage.js's job — and nothing here is exported; only this file needs it.
// ============================================================================

const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 hex digest, so a password never gets written to localStorage in plain text. */
const hashPassword = async (password) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return toHex(new Uint8Array(digest));
};

/** Random token for reset-password links (stands in for what a real backend would email). */
const generateToken = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Wires an eye-icon button to toggle an adjacent input between password/text. */
const initPasswordToggle = (toggleBtn, input) => {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', () => {
    const isRevealing = input.type === 'password';
    input.type = isRevealing ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(isRevealing));
    toggleBtn.setAttribute('aria-label', isRevealing ? 'Hide password' : 'Show password');
    toggleBtn.querySelector('use').setAttribute('href', isRevealing ? '#icon-eye-off' : '#icon-eye');
  });
};

/** Show (or clear) a validation error under an auth form field. */
const setFieldError = (input, errorEl, message) => {
  input.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (errorEl) errorEl.textContent = message || '';
};

let authToastTimeout = null;
const showAuthFeedback = (feedbackEl, message, { type = 'info', duration = 3200 } = {}) => {
  feedbackEl.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  toast.textContent = message;
  feedbackEl.appendChild(toast);

  clearTimeout(authToastTimeout);
  authToastTimeout = setTimeout(() => { feedbackEl.innerHTML = ''; }, duration);
};

/** login.html/signup.html only make sense signed out — bounce an existing session straight in. */
const redirectIfAuthenticated = () => {
  if (storage.loadSession()) window.location.replace('index.html');
};

/** Every auth page's "Google" button does the same not-really-implemented thing. */
const wireGoogleButton = (btn, feedbackEl) => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    showAuthFeedback(feedbackEl, "Google sign-in isn't available in this demo.", { type: 'error' });
  });
};

// ============================================================================
// Login page
// ============================================================================

function initLoginPage() {
  themes.applySavedPreferences();
  redirectIfAuthenticated();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const feedbackEl = document.getElementById('feedback');
  const googleBtn = document.getElementById('google-btn');

  initPasswordToggle(passwordToggle, passwordInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    let valid = true;
    if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(emailInput, emailError, '');
    }
    if (!password) {
      setFieldError(passwordInput, passwordError, 'Enter your password.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    if (!valid) {
      (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
      return;
    }

    const user = storage.findUserByEmail(email);
    const passwordHash = await hashPassword(password);

    if (!user || user.passwordHash !== passwordHash) {
      showAuthFeedback(feedbackEl, 'Incorrect email or password.', { type: 'error' });
      passwordInput.focus();
      return;
    }

    storage.saveSession(email);
    showAuthFeedback(feedbackEl, 'Welcome back! Redirecting…');
    setTimeout(() => { window.location.href = 'index.html'; }, 500);
  });

  wireGoogleButton(googleBtn, feedbackEl);
}

// ============================================================================
// Signup page
// ============================================================================

function initSignupPage() {
  themes.applySavedPreferences();
  redirectIfAuthenticated();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const feedbackEl = document.getElementById('feedback');
  const googleBtn = document.getElementById('google-btn');

  initPasswordToggle(passwordToggle, passwordInput);

  function validate() {
    let valid = true;
    if (!isValidEmail(emailInput.value.trim())) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      valid = false;
    } else {
      setFieldError(emailInput, emailError, '');
    }
    if (passwordInput.value.length < 8) {
      setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    return valid;
  }

  emailInput.addEventListener('blur', validate);
  passwordInput.addEventListener('blur', validate);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) {
      (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
      return;
    }

    const email = emailInput.value.trim();
    if (storage.findUserByEmail(email)) {
      setFieldError(emailInput, emailError, 'An account with this email already exists.');
      emailInput.focus();
      return;
    }

    const passwordHash = await hashPassword(passwordInput.value);
    storage.addUser({ email, passwordHash });
    storage.saveSession(email);

    showAuthFeedback(feedbackEl, 'Account created! Redirecting…');
    setTimeout(() => { window.location.href = 'index.html'; }, 600);
  });

  wireGoogleButton(googleBtn, feedbackEl);
}

// ============================================================================
// Forgot-password page
// ============================================================================

function initForgotPasswordPage() {
  themes.applySavedPreferences();

  const form = document.getElementById('auth-form');
  const emailInput = document.getElementById('email');
  const emailError = document.getElementById('email-error');
  const feedbackEl = document.getElementById('feedback');
  const demoNotice = document.getElementById('demo-reset-notice');
  const demoLink = document.getElementById('demo-reset-link');

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setFieldError(emailInput, emailError, 'Enter a valid email address.');
      emailInput.focus();
      return;
    }
    setFieldError(emailInput, emailError, '');

    const token = generateToken();
    storage.saveResetRequest(email, token);

    form.hidden = true;
    // Deliberately doesn't reveal whether the email actually has an account —
    // the reset-password page is what actually rejects unknown emails.
    showAuthFeedback(feedbackEl, `If an account exists for ${email}, reset instructions have been sent.`);

    demoLink.href = `reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;
    demoNotice.hidden = false;
  });
}

// ============================================================================
// Reset-password page
// ============================================================================

function initResetPasswordPage() {
  themes.applySavedPreferences();

  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const token = params.get('token') || '';

  const formView = document.getElementById('reset-form-view');
  const invalidNotice = document.getElementById('invalid-link-notice');
  const form = document.getElementById('auth-form');
  const passwordInput = document.getElementById('password');
  const passwordError = document.getElementById('password-error');
  const passwordToggle = document.getElementById('password-toggle');
  const confirmInput = document.getElementById('confirm-password');
  const confirmError = document.getElementById('confirm-password-error');
  const confirmToggle = document.getElementById('confirm-password-toggle');
  const feedbackEl = document.getElementById('feedback');

  const request = storage.loadResetRequest();
  const linkIsValid = Boolean(
    request &&
    email &&
    request.email.toLowerCase() === email.toLowerCase() &&
    request.token === token &&
    request.expiresAt > Date.now() &&
    storage.findUserByEmail(email)
  );

  if (!linkIsValid) {
    formView.hidden = true;
    invalidNotice.hidden = false;
    return;
  }

  initPasswordToggle(passwordToggle, passwordInput);
  initPasswordToggle(confirmToggle, confirmInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    if (passwordInput.value.length < 8) {
      setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else {
      setFieldError(passwordInput, passwordError, '');
    }
    if (confirmInput.value !== passwordInput.value) {
      setFieldError(confirmInput, confirmError, "Passwords don't match.");
      valid = false;
    } else {
      setFieldError(confirmInput, confirmError, '');
    }
    if (!valid) {
      (passwordInput.classList.contains('is-invalid') ? passwordInput : confirmInput).focus();
      return;
    }

    const passwordHash = await hashPassword(passwordInput.value);
    storage.updateUserPassword(email, passwordHash);
    storage.clearResetRequest();

    form.hidden = true;

    // "Change Password" (in the notes app settings) reaches this page while
    // already logged in — sending that visitor to login.html would just
    // bounce them straight back to index.html, leaving a stale message.
    const alreadySignedIn = storage.loadSession();
    const destination = alreadySignedIn ? 'index.html' : 'login.html';
    showAuthFeedback(feedbackEl, alreadySignedIn ? 'Password updated!' : 'Password updated! Redirecting to login…');
    setTimeout(() => { window.location.href = destination; }, 900);
  });
}

// ============================================================================
// Notes app (index.html)
// ============================================================================

function initNotesApp() {
  // ---------------------------------------------------------------------
  // Elements
  // ---------------------------------------------------------------------

  const searchInput = document.getElementById('search-input');
  const notesListEl = document.getElementById('notes-list');
  const tagListEl = document.getElementById('tag-list');
  const folderListEl = document.getElementById('folder-list');
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
  const noteFolderSelect = document.getElementById('note-folder');
  const notePreview = document.getElementById('note-preview');
  const previewToggleBtn = document.getElementById('preview-toggle-btn');
  const editorToolbar = document.querySelector('.editor-toolbar');
  const lastEditedRow = document.getElementById('last-edited-row');
  const lastEditedEl = document.getElementById('note-last-edited');

  const addLocationBtn = document.getElementById('add-location-btn');
  const locationDisplay = document.getElementById('location-display');

  const actionsPanel = document.getElementById('actions-panel');
  const shareNoteBtn = document.getElementById('share-note-btn');
  const archiveNoteBtn = document.getElementById('archive-note-btn');
  const archiveNoteLabel = document.getElementById('archive-note-label');
  const deleteNoteBtn = document.getElementById('delete-note-btn');

  const confirmModal = document.getElementById('confirm-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  const confirmBodyText = document.getElementById('confirm-body-text');

  const shareModal = document.getElementById('share-modal');
  const shareLinkInput = document.getElementById('share-link-input');
  const copyShareLinkBtn = document.getElementById('copy-share-link-btn');
  const shareCloseBtn = document.getElementById('share-close-btn');

  const sharedNoteModal = document.getElementById('shared-note-modal');
  const sharedNoteSummary = document.getElementById('shared-note-summary');
  const sharedNoteDismissBtn = document.getElementById('shared-note-dismiss-btn');
  const sharedNoteImportBtn = document.getElementById('shared-note-import-btn');

  const settingsBtn = document.getElementById('settings-btn');
  const settingsPopover = document.getElementById('settings-popover');
  const settingsPanels = document.querySelectorAll('.settings-panel');
  const themeSelect = document.getElementById('theme-select');
  const fontSelect = document.getElementById('font-select');
  const changePasswordBtn = document.getElementById('change-password-btn');
  const logoutBtn = document.getElementById('logout-btn');

  const viewTitle = document.getElementById('view-title');
  const viewSubtitle = document.getElementById('view-subtitle');

  const exportBtn = document.getElementById('export-btn');
  const importBtn = document.getElementById('import-btn');
  const importFileInput = document.getElementById('import-file-input');

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------

  const state = {
    filter: 'all',        // 'all' | 'archived'
    tag: null,             // string | null
    folder: null,          // string | null
    search: '',
    selectedId: null,      // note id currently shown in the detail panel
    isCreating: false,     // true while composing a brand-new (unsaved) note
    pendingLocation: null,
    pendingDeleteId: null,
    draggedId: null,       // note id currently being dragged (drag & drop bonus)
    previewing: false,     // markdown preview mode (bonus)
  };

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  function getVisibleNotes() {
    let list = noteManager.filterByArchived(state.filter === 'archived');
    if (state.tag) list = noteManager.filterByTag(state.tag, list);
    if (state.folder) list = noteManager.filterByFolder(state.folder, list);
    if (state.search) list = noteManager.searchNotes(state.search, list);
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function emptyMessage() {
    if (state.search) return `No notes match "${state.search}".`;
    if (state.folder) return `No notes in ${state.folder} yet.`;
    if (state.tag) return `No notes tagged ${state.tag} yet.`;
    if (state.filter === 'archived') return 'Nothing archived. Notes you archive will land here.';
    return 'Write your first note — it takes less time than finding a pen.';
  }

  function updateHeader() {
    viewTitle.textContent = state.filter === 'archived' ? 'Archived Notes' : 'All Notes';
    const parts = [];
    if (state.folder) parts.push(`in ${state.folder}`);
    if (state.tag) parts.push(`tagged ${state.tag}`);
    if (state.search) parts.push(`matching "${state.search}"`);
    viewSubtitle.textContent = parts.join(' · ');
  }

  function populateFolderSelect() {
    const folders = noteManager.getAllFolders();
    const current = noteFolderSelect.value;
    noteFolderSelect.innerHTML = '';
    folders.forEach((folder) => {
      const opt = document.createElement('option');
      opt.value = folder;
      opt.textContent = folder;
      noteFolderSelect.appendChild(opt);
    });
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '+ New folder…';
    noteFolderSelect.appendChild(newOpt);
    if (folders.includes(current)) noteFolderSelect.value = current;
  }

  function render() {
    const visible = getVisibleNotes();
    ui.renderNotesList(visible, {
      highlight: state.search,
      emptyMessage: emptyMessage(),
      selectedId: state.selectedId,
    });
    ui.updateTagList(noteManager.getAllTags(), state.tag);
    ui.updateFolderList(noteManager.getAllFolders(), state.folder);
    ui.toggleArchiveView(state.filter === 'archived');
    updateHeader();
  }

  // ---------------------------------------------------------------------
  // Detail panel helpers
  // ---------------------------------------------------------------------

  function showForm() {
    noteForm.hidden = false;
    emptyDetail.hidden = true;
  }

  function setPreviewMode(on) {
    state.previewing = on;
    notePreview.hidden = !on;
    noteContentInput.hidden = on;
    editorToolbar.querySelectorAll('.editor-tool:not(.editor-tool-preview)').forEach((btn) => {
      btn.disabled = on;
    });
    previewToggleBtn.setAttribute('aria-pressed', String(on));
    previewToggleBtn.querySelector('use').setAttribute('href', on ? '#icon-eye-off' : '#icon-eye');
    if (on) notePreview.innerHTML = ui.renderMarkdown(noteContentInput.value) || '<p class="empty-body">Nothing to preview yet.</p>';
  }

  function closeDetail() {
    state.selectedId = null;
    state.isCreating = false;
    state.pendingLocation = null;
    noteForm.hidden = true;
    emptyDetail.hidden = false;
    actionsPanel.hidden = true;
    noteForm.reset();
    setPreviewMode(false);
    ui.showValidationError('note-title', '');
    render();
  }

  function fillFormFrom(note) {
    noteIdInput.value = note.id;
    noteTitleInput.value = note.title;
    noteContentInput.value = note.content;
    noteTagsInput.value = note.tags.join(', ');
    populateFolderSelect();
    noteFolderSelect.value = note.folder || 'Uncategorized';
    lastEditedRow.hidden = false;
    lastEditedEl.textContent = new Date(note.updatedAt || note.createdAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
    locationDisplay.textContent = note.location
      ? `📍 ${note.location.city || `${note.location.lat.toFixed(2)}, ${note.location.lng.toFixed(2)}`}`
      : '';
    ui.showValidationError('note-title', '');
    saveBtn.disabled = false;
    setPreviewMode(false);
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
    populateFolderSelect();
    noteFolderSelect.value = 'Uncategorized';
    lastEditedRow.hidden = true;
    locationDisplay.textContent = '';
    ui.showValidationError('note-title', '');
    saveBtn.disabled = true;
    setPreviewMode(false);

    restoreDraftIfAny();
    showForm();
    actionsPanel.hidden = true;
    render();
    noteTitleInput.focus();
  }

  // ---------------------------------------------------------------------
  // Validation + drafts
  // ---------------------------------------------------------------------

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
        folder: noteFolderSelect.value,
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
    if (draft.folder) noteFolderSelect.value = draft.folder;
    saveBtn.disabled = !isTitleValid();
    if (draft.title || draft.content) {
      ui.showFeedback('Restored your unsaved draft.');
    }
  }

  // ---------------------------------------------------------------------
  // Formatting toolbar (bonus: rich-text-ish editing + markdown preview)
  // ---------------------------------------------------------------------

  function wrapSelection(before, after = before) {
    const start = noteContentInput.selectionStart;
    const end = noteContentInput.selectionEnd;
    const value = noteContentInput.value;
    const selected = value.slice(start, end) || 'text';
    noteContentInput.value = value.slice(0, start) + before + selected + after + value.slice(end);
    noteContentInput.focus();
    noteContentInput.setSelectionRange(start + before.length, start + before.length + selected.length);
    autosaveDraft();
  }

  function prefixLines(prefix, numbered = false) {
    const start = noteContentInput.selectionStart;
    const end = noteContentInput.selectionEnd;
    const value = noteContentInput.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.split('\n');
    const updated = lines.map((line, i) => `${numbered ? `${i + 1}. ` : prefix}${line}`).join('\n');
    noteContentInput.value = value.slice(0, lineStart) + updated + value.slice(lineEnd);
    noteContentInput.focus();
    autosaveDraft();
  }

  editorToolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('.editor-tool');
    if (!btn || btn === previewToggleBtn) return;
    switch (btn.dataset.format) {
      case 'bold': wrapSelection('**'); break;
      case 'italic': wrapSelection('*'); break;
      case 'bullet': prefixLines('- '); break;
      case 'number': prefixLines('', true); break;
      case 'link': wrapSelection('[', '](https://)'); break;
      default: break;
    }
  });

  previewToggleBtn.addEventListener('click', () => setPreviewMode(!state.previewing));

  // ---------------------------------------------------------------------
  // Folder select: "+ New folder…" prompts for a name
  // ---------------------------------------------------------------------

  noteFolderSelect.addEventListener('change', () => {
    if (noteFolderSelect.value !== '__new__') { autosaveDraft(); return; }
    const name = window.prompt('New folder name:');
    populateFolderSelect();
    noteFolderSelect.value = name && name.trim() ? name.trim() : 'Uncategorized';
    autosaveDraft();
  });

  // ---------------------------------------------------------------------
  // Form submit (create / update) + cancel
  // ---------------------------------------------------------------------

  noteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateTitle()) {
      noteTitleInput.focus();
      return;
    }

    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const tags = noteTagsInput.value;
    const folder = noteFolderSelect.value === '__new__' ? 'Uncategorized' : noteFolderSelect.value;

    if (state.isCreating) {
      const note = noteManager.createNote(title, content, tags, folder);
      if (state.pendingLocation) {
        noteManager.updateNote(note.id, { location: state.pendingLocation });
      }
      storage.clearDraft();
      ui.showFeedback('Note saved.');
      selectNote(noteManager.getNotes().find((n) => n.id === note.id));
    } else if (state.selectedId) {
      noteManager.updateNote(state.selectedId, { title, content, tags, folder, location: state.pendingLocation });
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

  // ---------------------------------------------------------------------
  // Geolocation (bonus browser API)
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Note list selection + drag & drop (reorder / move to folder / archive)
  // ---------------------------------------------------------------------

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

  notesListEl.addEventListener('dragstart', (e) => {
    const item = e.target.closest('.note-item');
    if (!item) return;
    state.draggedId = item.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.dataset.id);
    item.classList.add('is-dragging');
  });

  notesListEl.addEventListener('dragend', (e) => {
    const item = e.target.closest('.note-item');
    if (item) item.classList.remove('is-dragging');
    state.draggedId = null;
  });

  notesListEl.addEventListener('dragover', (e) => {
    if (!state.draggedId) return;
    e.preventDefault();
    const item = e.target.closest('.note-item');
    notesListEl.querySelectorAll('.note-item.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (item && item.dataset.id !== state.draggedId) item.classList.add('is-drag-over');
  });

  notesListEl.addEventListener('drop', (e) => {
    if (!state.draggedId) return;
    e.preventDefault();
    const item = e.target.closest('.note-item');
    notesListEl.querySelectorAll('.note-item.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
    if (item && item.dataset.id !== state.draggedId) {
      noteManager.reorderNotes(state.draggedId, item.dataset.id);
      render();
    }
  });

  // Drop a dragged note onto a folder chip to move it there.
  folderListEl.addEventListener('dragover', (e) => {
    const chip = e.target.closest('[data-drop-target="folder"]');
    if (!chip || !state.draggedId) return;
    e.preventDefault();
    chip.classList.add('is-drag-over');
  });
  folderListEl.addEventListener('dragleave', (e) => {
    const chip = e.target.closest('[data-drop-target="folder"]');
    if (chip) chip.classList.remove('is-drag-over');
  });
  folderListEl.addEventListener('drop', (e) => {
    const chip = e.target.closest('[data-drop-target="folder"]');
    if (!chip || !state.draggedId) return;
    e.preventDefault();
    chip.classList.remove('is-drag-over');
    noteManager.updateNote(state.draggedId, { folder: chip.dataset.folder });
    ui.showFeedback(`Moved to ${chip.dataset.folder}.`);
    render();
  });

  // Drop a dragged note onto "Archived Notes" / "All Notes" to (un)archive it.
  filterButtons.forEach((btn) => {
    btn.addEventListener('dragover', (e) => {
      if (!state.draggedId) return;
      e.preventDefault();
      btn.classList.add('is-drag-over');
    });
    btn.addEventListener('dragleave', () => btn.classList.remove('is-drag-over'));
    btn.addEventListener('drop', (e) => {
      if (!state.draggedId) return;
      e.preventDefault();
      btn.classList.remove('is-drag-over');
      const note = noteManager.getNotes().find((n) => n.id === state.draggedId);
      if (!note) return;
      const wantsArchived = btn.dataset.filter === 'archived';
      if (Boolean(note.archived) !== wantsArchived) {
        noteManager.toggleArchive(note.id);
        ui.showFeedback(wantsArchived ? 'Note archived.' : 'Note unarchived.');
        render();
      }
    });
  });

  // ---------------------------------------------------------------------
  // Actions panel: share / archive / delete the currently selected note
  // ---------------------------------------------------------------------

  shareNoteBtn.addEventListener('click', async () => {
    if (!state.selectedId) return;
    const note = noteManager.getNotes().find((n) => n.id === state.selectedId);
    if (!note) return;

    const payload = { t: note.title, c: note.content, tg: note.tags, f: note.folder };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    const url = `${window.location.origin}${window.location.pathname}#share=${encoded}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, text: 'Shared from Notes', url });
        return;
      } catch {
        // Fall through to the copy-link modal if the share sheet was cancelled/unavailable.
      }
    }

    shareLinkInput.value = url;
    shareModal.showModal();
    shareLinkInput.focus();
    shareLinkInput.select();
  });

  copyShareLinkBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareLinkInput.value);
      ui.showFeedback('Link copied to clipboard.');
    } catch {
      shareLinkInput.select();
      ui.showFeedback('Press Ctrl/Cmd+C to copy the selected link.');
    }
  });
  shareCloseBtn.addEventListener('click', () => shareModal.close());

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
    confirmBodyText.textContent = `"${note.title}" will be permanently deleted. This can't be undone.`;
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

  // ---------------------------------------------------------------------
  // Shared-note links (bonus): #share=<base64 JSON> in the URL
  // ---------------------------------------------------------------------

  let incomingSharedNote = null;

  function checkForSharedNoteLink() {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    try {
      const encoded = hash.slice('#share='.length);
      const payload = JSON.parse(decodeURIComponent(atob(encoded)));
      if (!payload || typeof payload.t !== 'string') throw new Error('bad payload');
      incomingSharedNote = payload;
      sharedNoteSummary.textContent = `"${payload.t}" — ${(payload.c || '').slice(0, 140)}${(payload.c || '').length > 140 ? '…' : ''}`;
      sharedNoteModal.showModal();
    } catch {
      ui.showFeedback('That share link looks corrupted.', { type: 'error' });
    } finally {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  sharedNoteDismissBtn.addEventListener('click', () => {
    incomingSharedNote = null;
    sharedNoteModal.close();
  });
  sharedNoteImportBtn.addEventListener('click', () => {
    if (!incomingSharedNote) return;
    const note = noteManager.createNote(
      incomingSharedNote.t,
      incomingSharedNote.c,
      incomingSharedNote.tg || [],
      incomingSharedNote.f
    );
    ui.showFeedback('Shared note added.');
    sharedNoteModal.close();
    incomingSharedNote = null;
    render();
    selectNote(note);
  });

  // ---------------------------------------------------------------------
  // Export / Import JSON (bonus)
  // ---------------------------------------------------------------------

  exportBtn.addEventListener('click', () => {
    const data = JSON.stringify(noteManager.getNotes(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `notes-export-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    ui.showFeedback('Notes exported.');
  });

  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', () => {
    const file = importFileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed.notes;
        const added = noteManager.mergeIn(list);
        ui.showFeedback(`Imported ${added} note${added === 1 ? '' : 's'}.`);
        render();
      } catch {
        ui.showFeedback('That file is not a valid notes export.', { type: 'error' });
      } finally {
        importFileInput.value = '';
      }
    };
    reader.readAsText(file);
  });

  // ---------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------

  let searchTimeout = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.search = searchInput.value.trim();
      render();
    }, 150);
  });
  document.getElementById('search-form').addEventListener('submit', (e) => e.preventDefault());

  // ---------------------------------------------------------------------
  // Sidebar: view filter (all / archived), tag filter, folder filter
  // ---------------------------------------------------------------------

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

  folderListEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.folder-chip');
    if (!chip) return;
    const folder = chip.dataset.folder;
    state.folder = state.folder === folder ? null : folder;
    render();
    closeSidebarOnMobile();
  });

  // ---------------------------------------------------------------------
  // Mobile sidebar toggle
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // Settings popover (theme + font)
  // ---------------------------------------------------------------------

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
    const session = storage.loadSession();
    if (!session) return;
    // Reuses the reset-password flow rather than a separate page: it already
    // knows how to take a new password and write the hash, and the reset
    // token still guards against the form being reachable without this click.
    const token = generateToken();
    storage.saveResetRequest(session.email, token);
    window.location.href = `reset-password.html?email=${encodeURIComponent(session.email)}&token=${token}`;
  });

  logoutBtn.addEventListener('click', () => {
    storage.clearSession();
    window.location.href = 'login.html';
  });

  // ---------------------------------------------------------------------
  // Keyboard: Escape closes whichever overlay is open.
  // ---------------------------------------------------------------------

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sidebar.classList.contains('is-open')) closeSidebarOnMobile();
    if (!settingsPopover.hidden) closeSettingsPopover();
  });

  // ---------------------------------------------------------------------
  // Theme & font controls (segmented icon buttons)
  // ---------------------------------------------------------------------

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

  // ---------------------------------------------------------------------
  // PWA: offline support (bonus)
  // ---------------------------------------------------------------------

  if ('serviceWorker' in navigator) {
    // Registration silently no-ops (and rejects) on file:// or unsupported
    // setups, which is fine — the rest of the app doesn't depend on it.
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }

  // ---------------------------------------------------------------------
  // Startup
  // ---------------------------------------------------------------------

  function init() {
    document.getElementById('storage-warning').hidden = storage.isStorageAvailable();

    const prefs = themes.applySavedPreferences();
    setActiveSegment(themeSelect, prefs.theme);
    setActiveSegment(fontSelect, prefs.font);
    noteManager.init();
    populateFolderSelect();
    render();
    checkForSharedNoteLink();

    // If a draft exists from a previous session, let the user know they can
    // resume it via "+ Create New Note".
    const draft = storage.loadDraft();
    if (draft && (draft.title || draft.content)) {
      ui.showFeedback('You have an unsaved draft — open "+ Create New Note" to resume it.');
    }
  }

  init();
}

// ============================================================================
// Page dispatch
// ============================================================================

if (document.getElementById('app')) {
  initNotesApp();
} else {
  switch (document.body.dataset.authPage) {
    case 'login': initLoginPage(); break;
    case 'signup': initSignupPage(); break;
    case 'forgot-password': initForgotPasswordPage(); break;
    case 'reset-password': initResetPasswordPage(); break;
    default: break;
  }
}
