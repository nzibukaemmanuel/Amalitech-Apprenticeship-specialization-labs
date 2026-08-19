/**
 * All DOM rendering and manipulation for the Journal App.
 * This module never touches localStorage or business rules directly —
 * it only renders JournalEntry[] and reports user intent via callbacks.
 */

import { JournalEntry, JournalStats, Mood, MOOD_META } from "./types.js";
import { escapeHtml, formatDate, truncate } from "./utils.js";

const PREVIEW_LENGTH = 160;

interface FormValues {
  title: string;
  content: string;
  mood: Mood;
}

export interface UICallbacks {
  onSubmit: (values: FormValues, editingId: string | null) => void;
  onDelete: (id: string) => void;
  onEditRequest: (id: string) => JournalEntry | undefined;
  onFilterChange: (mood: Mood | undefined, query: string) => void;
  onCancelEdit: () => void;
}

// Cached DOM references, populated once by initUI().
let form: HTMLFormElement;
let titleInput: HTMLInputElement;
let contentInput: HTMLTextAreaElement;
let charCount: HTMLElement;
let moodSelector: HTMLElement;
let formHeading: HTMLElement;
let submitButton: HTMLButtonElement;
let cancelButton: HTMLButtonElement;
let moodFilter: HTMLSelectElement;
let searchInput: HTMLInputElement;
let entriesList: HTMLElement;
let emptyState: HTMLElement;
let statsBar: HTMLElement;
let toastContainer: HTMLElement;

let selectedMood: Mood | null = null;
let editingId: string | null = null;

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element #${id}`);
  return element as T;
}

/**
 * Wires up all DOM references and event listeners exactly once.
 * `callbacks` is how ui.ts reports user intent back to main.ts without
 * importing journal.ts — keeping rendering decoupled from business logic.
 */
export function initUI(callbacks: UICallbacks): void {
  form = byId<HTMLFormElement>("entry-form");
  titleInput = byId<HTMLInputElement>("entry-title");
  contentInput = byId<HTMLTextAreaElement>("entry-content");
  charCount = byId<HTMLElement>("char-count");
  moodSelector = byId<HTMLElement>("mood-selector");
  formHeading = byId<HTMLElement>("form-heading");
  submitButton = byId<HTMLButtonElement>("submit-button");
  cancelButton = byId<HTMLButtonElement>("cancel-edit-button");
  moodFilter = byId<HTMLSelectElement>("mood-filter");
  searchInput = byId<HTMLInputElement>("search-input");
  entriesList = byId<HTMLElement>("entries-list");
  emptyState = byId<HTMLElement>("empty-state");
  statsBar = byId<HTMLElement>("stats-bar");
  toastContainer = byId<HTMLElement>("toast-container");

  buildMoodSelector();
  buildMoodFilterOptions();

  contentInput.addEventListener("input", () => {
    charCount.textContent = `${contentInput.value.length} characters`;
  });

  form.addEventListener("submit", (event: SubmitEvent) => {
    event.preventDefault();
    if (!selectedMood) {
      showToast("Please pick a mood for this entry.", "error");
      return;
    }
    callbacks.onSubmit(
      { title: titleInput.value, content: contentInput.value, mood: selectedMood },
      editingId
    );
  });

  cancelButton.addEventListener("click", () => {
    callbacks.onCancelEdit();
    exitEditMode();
  });

  moodFilter.addEventListener("change", () => {
    const value = moodFilter.value as Mood | "";
    callbacks.onFilterChange(value === "" ? undefined : value, searchInput.value);
  });

  searchInput.addEventListener("input", () => {
    const value = moodFilter.value as Mood | "";
    callbacks.onFilterChange(value === "" ? undefined : value, searchInput.value);
  });

  // Event delegation: one listener handles every card's buttons and
  // expand/collapse toggle, including cards rendered after this point.
  entriesList.addEventListener("click", (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>("[data-entry-id]");
    if (!card) return;
    const id = card.dataset.entryId;
    if (!id) return;

    if (target.closest("[data-action='delete']")) {
      handleDelete(id, card, callbacks.onDelete);
    } else if (target.closest("[data-action='edit']")) {
      const entry = callbacks.onEditRequest(id);
      if (entry) enterEditMode(entry);
    } else if (target.closest("[data-action='toggle']")) {
      card.classList.toggle("entry-card--expanded");
    }
  });
}

function buildMoodSelector(): void {
  moodSelector.innerHTML = "";
  (Object.keys(MOOD_META) as Mood[]).forEach((mood) => {
    const meta = MOOD_META[mood];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mood-pill ${meta.className}`;
    button.dataset.mood = mood;
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = `<span aria-hidden="true">${meta.emoji}</span> ${meta.label}`;
    button.addEventListener("click", () => selectMood(mood));
    moodSelector.appendChild(button);
  });
}

function selectMood(mood: Mood): void {
  selectedMood = mood;
  moodSelector.querySelectorAll<HTMLButtonElement>(".mood-pill").forEach((pill) => {
    const isActive = pill.dataset.mood === mood;
    pill.classList.toggle("mood-pill--active", isActive);
    pill.setAttribute("aria-pressed", String(isActive));
  });
}

function buildMoodFilterOptions(): void {
  (Object.keys(MOOD_META) as Mood[]).forEach((mood) => {
    const option = document.createElement("option");
    option.value = mood;
    option.textContent = `${MOOD_META[mood].emoji} ${MOOD_META[mood].label}`;
    moodFilter.appendChild(option);
  });
}

function handleDelete(id: string, card: HTMLElement, onDelete: (id: string) => void): void {
  card.classList.add("entry-card--removing");
  card.addEventListener(
    "animationend",
    () => {
      onDelete(id);
    },
    { once: true }
  );
}

function enterEditMode(entry: JournalEntry): void {
  editingId = entry.id;
  titleInput.value = entry.title;
  contentInput.value = entry.content;
  charCount.textContent = `${entry.content.length} characters`;
  selectMood(entry.mood);
  formHeading.textContent = "Edit entry";
  submitButton.textContent = "Save changes";
  cancelButton.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  titleInput.focus();
}

function exitEditMode(): void {
  editingId = null;
  resetForm();
}

/** Clears the form back to its "compose a new entry" state. */
export function resetForm(): void {
  form.reset();
  charCount.textContent = "0 characters";
  selectedMood = null;
  editingId = null;
  moodSelector.querySelectorAll<HTMLButtonElement>(".mood-pill").forEach((pill) => {
    pill.classList.remove("mood-pill--active");
    pill.setAttribute("aria-pressed", "false");
  });
  formHeading.textContent = "New entry";
  submitButton.textContent = "Save entry";
  cancelButton.hidden = true;
}

/** Renders the full list of entries as cards, or the empty state. */
export function renderEntries(entries: JournalEntry[]): void {
  entriesList.innerHTML = "";

  if (entries.length === 0) {
    emptyState.hidden = false;
    return;
  }
  emptyState.hidden = true;

  for (const entry of entries) {
    entriesList.appendChild(buildEntryCard(entry));
  }
}

function buildEntryCard(entry: JournalEntry): HTMLElement {
  const meta = MOOD_META[entry.mood];
  const card = document.createElement("article");
  card.className = "entry-card entry-card--enter";
  card.dataset.entryId = entry.id;

  const isLong = entry.content.length > PREVIEW_LENGTH;
  const safeTitle = escapeHtml(entry.title);
  const safeContent = escapeHtml(entry.content);
  const preview = escapeHtml(truncate(entry.content, PREVIEW_LENGTH));

  card.innerHTML = `
    <header class="entry-card__header">
      <h3 class="entry-card__title">${safeTitle}</h3>
      <span class="mood-badge ${meta.className}">
        <span aria-hidden="true">${meta.emoji}</span>${meta.label}
      </span>
    </header>
    <p class="entry-card__content entry-card__content--full">${safeContent}</p>
    <p class="entry-card__content entry-card__content--preview">${preview}</p>
    <footer class="entry-card__footer">
      <div class="entry-card__meta">
        <time class="entry-card__date">${formatDate(entry.timestamp)}</time>
        ${entry.editedAt ? `<span class="entry-card__edited">Last edited ${formatDate(entry.editedAt)}</span>` : ""}
      </div>
      <div class="entry-card__actions">
        ${isLong ? `<button type="button" class="icon-button" data-action="toggle" aria-label="Expand or collapse entry">⤢</button>` : ""}
        <button type="button" class="icon-button" data-action="edit" aria-label="Edit entry">✎</button>
        <button type="button" class="icon-button icon-button--danger" data-action="delete" aria-label="Delete entry">🗑</button>
      </div>
    </footer>
  `;

  return card;
}

/** Renders the total-entries / most-frequent-mood statistics bar. if no data is available, hides the bar. */
export function renderStats(stats: JournalStats): void {
  if (stats.total === 0) {
    statsBar.innerHTML = "";
    statsBar.hidden = true;
    return;
  }
  statsBar.hidden = false;

  const moodLabel = stats.mostFrequentMood ? MOOD_META[stats.mostFrequentMood].label : "—";
  const moodEmoji = stats.mostFrequentMood ? MOOD_META[stats.mostFrequentMood].emoji : "";

  statsBar.innerHTML = `
    <div class="stat"><span class="stat__value">${stats.total}</span><span class="stat__label">Entries</span></div>
    <div class="stat"><span class="stat__value">${moodEmoji} ${moodLabel}</span><span class="stat__label">Most frequent mood</span></div>
  `;
}

/** Shows a transient toast confirming an action, e.g. save or delete. */
export function showToast(message: string, variant: "success" | "error" = "success"): void {
  const toast = document.createElement("div");
  toast.className = `toast toast--${variant}`;
  toast.textContent = message;
  toast.setAttribute("role", "status");
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast--leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 2600);
}
