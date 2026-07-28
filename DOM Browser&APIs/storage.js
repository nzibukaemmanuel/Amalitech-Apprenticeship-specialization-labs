// storage.js
// Everything that touches localStorage / sessionStorage lives here so the
// rest of the app never has to think about serialization or quota errors.

// v2: the example-note set changed shape (different sample notes/tags), so
// the key is bumped to give anyone who already loaded the old samples a
// clean slate instead of a stale mix of old and new seed data.
const NOTES_KEY = 'marginalia:notes:v2';
const PREFS_KEY = 'marginalia:preferences';
const DRAFT_KEY = 'marginalia:draft';
const SEEDED_KEY = 'marginalia:seeded:v2';

const DEFAULT_PREFS = { theme: 'light', font: 'sans' };

/**
 * Browsers block localStorage on file:// pages (opaque origin), which makes
 * every save fail silently. Call this once at startup so the app can warn
 * the user instead of pretending notes were saved.
 */
export const isStorageAvailable = () => {
  try {
    const testKey = '__marginalia_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * Persist the full notes array as JSON.
 * Returns true on success, false if storage failed (quota exceeded, disabled, etc).
 */
export const saveNotes = (notes) => {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch (err) {
    console.error('Could not save notes to localStorage:', err);
    return false;
  }
};

/**
 * Load notes from localStorage. Returns [] if nothing is stored or the
 * stored value is corrupted, so callers never have to null-check.
 */
export const loadNotes = () => {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Could not read notes from localStorage:', err);
    return [];
  }
};

export const savePreferences = (prefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    return true;
  } catch (err) {
    console.error('Could not save preferences:', err);
    return false;
  }
};

export const loadPreferences = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Could not read preferences:', err);
    return { ...DEFAULT_PREFS };
  }
};

/**
 * Drafts live in sessionStorage: they're only meant to survive an accidental
 * reload/tab-close within the same session, not to persist forever.
 */
export const saveDraft = (draft) => {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch (err) {
    console.error('Could not save draft:', err);
    return false;
  }
};

export const loadDraft = () => {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Could not read draft:', err);
    return null;
  }
};

export const clearDraft = () => {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch (err) {
    console.error('Could not clear draft:', err);
  }
};

/**
 * Tracks whether the one-time example notes have already been added, so a
 * user who deletes everything gets a genuinely empty list instead of the
 * samples reappearing on next load.
 */
export const wasSeeded = () => {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch (err) {
    return false;
  }
};

export const markSeeded = () => {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch (err) {
    console.error('Could not persist seed marker:', err);
  }
};
