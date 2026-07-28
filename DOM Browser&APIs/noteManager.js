// noteManager.js
// Owns the in-memory notes collection and every operation that changes it.
// Every mutating function persists to storage before returning, so callers
// (main.js) only ever have to re-render.

import * as storage from './storage.js';

/** @typedef {{ city?: string, lat: number, lng: number }} NoteLocation */

export class Note {
  /**
   * @param {string} title
   * @param {string} content
   * @param {string[]} tags
   */
  constructor(title, content, tags = []) {
    this.id = generateId();
    this.title = title.trim();
    this.content = (content || '').trim();
    this.tags = normalizeTags(tags);
    this.archived = false;
    this.createdAt = new Date().toISOString();
    this.updatedAt = this.createdAt;
    /** @type {NoteLocation|null} */
    this.location = null;
  }

  archive() {
    this.archived = !this.archived;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  addTag(tag) {
    const clean = tag.trim().toLowerCase();
    if (clean && !this.tags.includes(clean)) {
      this.tags.push(clean);
      this.updatedAt = new Date().toISOString();
    }
    return this;
  }
}

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeTags(tags) {
  const list = Array.isArray(tags)
    ? tags
    : String(tags || '').split(',');
  const cleaned = list
    .map((t) => String(t).trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(cleaned)];
}

// ---------------------------------------------------------------------------
// In-memory state, hydrated once at startup by main.js calling init().
// ---------------------------------------------------------------------------

/** @type {Note[]} */
let notes = [];

// Always shown in the sidebar, even before any note uses them, so the tag
// list isn't empty for a brand-new install.
const DEFAULT_TAGS = [
  'cooking', 'dev', 'fitness', 'health', 'personal',
  'react', 'recipes', 'shopping', 'travel', 'typescript',
];

export const init = () => {
  notes = storage.loadNotes();
  return notes;
};

export const getNotes = () => notes;

export const getAllTags = () => {
  const set = new Set(DEFAULT_TAGS);
  notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
  return [...set].sort();
};

export const createNote = (title, content, tags) => {
  const note = new Note(title, content, tags);
  notes = [note, ...notes];
  storage.saveNotes(notes);
  return note;
};

export const deleteNote = (id) => {
  notes = notes.filter((n) => n.id !== id);
  storage.saveNotes(notes);
  return notes;
};

export const updateNote = (id, updates) => {
  let updated = null;
  notes = notes.map((n) => {
    if (n.id !== id) return n;
    updated = {
      ...n,
      ...updates,
      tags: updates.tags !== undefined ? normalizeTags(updates.tags) : n.tags,
      updatedAt: new Date().toISOString(),
    };
    return updated;
  });
  storage.saveNotes(notes);
  return updated;
};

export const toggleArchive = (id) => {
  let updated = null;
  notes = notes.map((n) => {
    if (n.id !== id) return n;
    updated = { ...n, archived: !n.archived, updatedAt: new Date().toISOString() };
    return updated;
  });
  storage.saveNotes(notes);
  return updated;
};

export const searchNotes = (query, list = notes) => {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((n) =>
    n.title.toLowerCase().includes(q) ||
    n.content.toLowerCase().includes(q) ||
    n.tags.some((t) => t.includes(q))
  );
};

export const filterByTag = (tag, list = notes) => {
  if (!tag) return list;
  return list.filter((n) => n.tags.includes(tag));
};

export const filterByArchived = (archived, list = notes) =>
  list.filter((n) => Boolean(n.archived) === archived);
