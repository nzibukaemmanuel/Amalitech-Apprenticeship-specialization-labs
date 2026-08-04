
import { EntryUpdate, Journal, JournalEntry, JournalStats, Mood, NewEntryInput } from "./types.js";
import { loadJournal, saveJournal } from "./storage.js";
import { findByProperty, generateId } from "./utils.js";

type Listener = (journal: Journal) => void;

export class JournalStore {
  private journal: Journal;
  private listeners: Listener[] = [];

  constructor() {
    this.journal = loadJournal();
  }

  /** Registers a callback invoked with the full journal after every mutation. */
  subscribe(listener: Listener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    saveJournal(this.journal);
    for (const listener of this.listeners) listener(this.journal);
  }

  getAll(): JournalEntry[] {
    return [...this.journal];
  }

  
  addEntry(partial: Partial<JournalEntry>): JournalEntry {
    if (!partial.title || !partial.title.trim()) {
      throw new Error("An entry requires a non-empty title.");
    }
    if (!partial.mood) {
      throw new Error("An entry requires a mood.");
    }

    const input: NewEntryInput = {
      title: partial.title.trim(),
      content: (partial.content ?? "").trim(),
      mood: partial.mood,
    };

    const entry: JournalEntry = {
      id: generateId(),
      timestamp: Date.now(),
      ...input,
    };

    this.journal = [entry, ...this.journal];
    this.notify();
    return entry;
  }

  editEntry(id: string, updates: EntryUpdate): boolean {
    const existing: JournalEntry | undefined = findByProperty(this.journal, "id", id);
    if (!existing) return false;

    const updated: JournalEntry = {
      ...existing,
      ...updates,
      id: existing.id,
      editedAt: Date.now(),
    };

    this.journal = this.journal.map((entry) => (entry.id === id ? updated : entry));
    this.notify();
    return true;
  }

  deleteEntry(id: string): boolean {
    const initialLength: number = this.journal.length;
    this.journal = this.journal.filter((entry) => entry.id !== id);
    const didDelete: boolean = this.journal.length < initialLength;
    if (didDelete) this.notify();
    return didDelete;
  }

  filterEntries(mood?: Mood, searchQuery?: string): JournalEntry[] {
    const query: string = (searchQuery ?? "").trim().toLowerCase();

    return this.journal.filter((entry) => {
      const matchesMood: boolean = !mood || entry.mood === mood;
      const matchesQuery: boolean =
        query.length === 0 ||
        entry.title.toLowerCase().includes(query) ||
        entry.content.toLowerCase().includes(query);
      return matchesMood && matchesQuery;
    });
  }

  getStats(): JournalStats {
    if (this.journal.length === 0) {
      return { total: 0, mostFrequentMood: null };
    }

    const counts = new Map<Mood, number>();
    for (const entry of this.journal) {
      counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
    }

    let mostFrequentMood: Mood | null = null;
    let highestCount = 0;
    for (const [mood, count] of counts) {
      if (count > highestCount) {
        highestCount = count;
        mostFrequentMood = mood;
      }
    }

    return { total: this.journal.length, mostFrequentMood };
  }
}
