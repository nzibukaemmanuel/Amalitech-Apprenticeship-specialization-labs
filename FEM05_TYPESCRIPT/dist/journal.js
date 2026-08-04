import { loadJournal, saveJournal } from "./storage.js";
import { findByProperty, generateId } from "./utils.js";
export class JournalStore {
    constructor() {
        this.listeners = [];
        this.journal = loadJournal();
    }
    /** Registers a callback invoked with the full journal after every mutation. */
    subscribe(listener) {
        this.listeners.push(listener);
    }
    notify() {
        saveJournal(this.journal);
        for (const listener of this.listeners)
            listener(this.journal);
    }
    getAll() {
        return [...this.journal];
    }
    addEntry(partial) {
        if (!partial.title || !partial.title.trim()) {
            throw new Error("An entry requires a non-empty title.");
        }
        if (!partial.mood) {
            throw new Error("An entry requires a mood.");
        }
        const input = {
            title: partial.title.trim(),
            content: (partial.content ?? "").trim(),
            mood: partial.mood,
        };
        const entry = {
            id: generateId(),
            timestamp: Date.now(),
            ...input,
        };
        this.journal = [entry, ...this.journal];
        this.notify();
        return entry;
    }
    editEntry(id, updates) {
        const existing = findByProperty(this.journal, "id", id);
        if (!existing)
            return false;
        const updated = {
            ...existing,
            ...updates,
            id: existing.id,
            editedAt: Date.now(),
        };
        this.journal = this.journal.map((entry) => (entry.id === id ? updated : entry));
        this.notify();
        return true;
    }
    deleteEntry(id) {
        const initialLength = this.journal.length;
        this.journal = this.journal.filter((entry) => entry.id !== id);
        const didDelete = this.journal.length < initialLength;
        if (didDelete)
            this.notify();
        return didDelete;
    }
    filterEntries(mood, searchQuery) {
        const query = (searchQuery ?? "").trim().toLowerCase();
        return this.journal.filter((entry) => {
            const matchesMood = !mood || entry.mood === mood;
            const matchesQuery = query.length === 0 ||
                entry.title.toLowerCase().includes(query) ||
                entry.content.toLowerCase().includes(query);
            return matchesMood && matchesQuery;
        });
    }
    getStats() {
        if (this.journal.length === 0) {
            return { total: 0, mostFrequentMood: null };
        }
        const counts = new Map();
        for (const entry of this.journal) {
            counts.set(entry.mood, (counts.get(entry.mood) ?? 0) + 1);
        }
        let mostFrequentMood = null;
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
//# sourceMappingURL=journal.js.map