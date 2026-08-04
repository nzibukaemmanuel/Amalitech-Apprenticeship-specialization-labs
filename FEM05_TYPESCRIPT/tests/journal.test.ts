import { describe, it, expect, beforeEach } from "vitest";
import { JournalStore } from "../src/journal";
import { Mood } from "../src/types";

beforeEach(() => {
  localStorage.clear();
});

describe("JournalStore", () => {
  it("starts empty when localStorage has nothing stored", () => {
    const store = new JournalStore();
    expect(store.getAll()).toEqual([]);
  });

  it("loads a previously persisted journal on construction", () => {
    const first = new JournalStore();
    first.addEntry({ title: "Existing", mood: Mood.HAPPY });

    const second = new JournalStore();
    expect(second.getAll()).toHaveLength(1);
    expect(second.getAll()[0].title).toBe("Existing");
  });

  describe("addEntry", () => {
    it("throws when title is missing", () => {
      const store = new JournalStore();
      expect(() => store.addEntry({ mood: Mood.HAPPY })).toThrow(
        "An entry requires a non-empty title."
      );
    });

    it("throws when title is only whitespace", () => {
      const store = new JournalStore();
      expect(() => store.addEntry({ title: "   ", mood: Mood.HAPPY })).toThrow(
        "An entry requires a non-empty title."
      );
    });

    it("throws when mood is missing", () => {
      const store = new JournalStore();
      expect(() => store.addEntry({ title: "No mood" })).toThrow(
        "An entry requires a mood."
      );
    });

    it("creates an entry with a generated id and timestamp", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "Hello", content: "World", mood: Mood.HAPPY });

      expect(entry.id).toBeTruthy();
      expect(typeof entry.timestamp).toBe("number");
      expect(entry.title).toBe("Hello");
      expect(entry.content).toBe("World");
      expect(entry.mood).toBe(Mood.HAPPY);
    });

    it("trims the title and defaults content to an empty string", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "  Padded  ", mood: Mood.SAD });

      expect(entry.title).toBe("Padded");
      expect(entry.content).toBe("");
    });

    it("prepends new entries so the most recent comes first", () => {
      const store = new JournalStore();
      store.addEntry({ title: "First", mood: Mood.HAPPY });
      store.addEntry({ title: "Second", mood: Mood.SAD });

      const all = store.getAll();
      expect(all[0].title).toBe("Second");
      expect(all[1].title).toBe("First");
    });

    it("persists the entry so it survives a fresh store instance", () => {
      const store = new JournalStore();
      store.addEntry({ title: "Persisted", mood: Mood.CALM });

      const reloaded = new JournalStore();
      expect(reloaded.getAll()).toHaveLength(1);
    });

    it("notifies subscribers with the updated journal", () => {
      const store = new JournalStore();
      const seen: number[] = [];
      store.subscribe((journal) => seen.push(journal.length));

      store.addEntry({ title: "Notify me", mood: Mood.MOTIVATED });
      expect(seen).toEqual([1]);
    });
  });

  describe("editEntry", () => {
    it("returns false when the id does not exist", () => {
      const store = new JournalStore();
      expect(store.editEntry("missing", { title: "New title" })).toBe(false);
    });

    it("updates the matching entry and sets editedAt", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "Original", mood: Mood.STRESSED });

      const didUpdate = store.editEntry(entry.id, { title: "Updated", content: "New content" });
      expect(didUpdate).toBe(true);

      const updated = store.getAll().find((e) => e.id === entry.id)!;
      expect(updated.title).toBe("Updated");
      expect(updated.content).toBe("New content");
      expect(updated.id).toBe(entry.id);
      expect(typeof updated.editedAt).toBe("number");
    });

    it("does not change the entry's id even if updates attempt to", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "Original", mood: Mood.CALM });

      store.editEntry(entry.id, { title: "Renamed" } as any);
      expect(store.getAll()[0].id).toBe(entry.id);
    });
  });

  describe("deleteEntry", () => {
    it("returns false when the id does not exist", () => {
      const store = new JournalStore();
      expect(store.deleteEntry("missing")).toBe(false);
    });

    it("removes the matching entry and returns true", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "To delete", mood: Mood.SAD });

      expect(store.deleteEntry(entry.id)).toBe(true);
      expect(store.getAll()).toEqual([]);
    });

    it("persists the deletion", () => {
      const store = new JournalStore();
      const entry = store.addEntry({ title: "To delete", mood: Mood.SAD });
      store.deleteEntry(entry.id);

      const reloaded = new JournalStore();
      expect(reloaded.getAll()).toEqual([]);
    });
  });

  describe("filterEntries", () => {
    function seeded(): JournalStore {
      const store = new JournalStore();
      store.addEntry({ title: "Morning run", content: "Felt great today", mood: Mood.MOTIVATED });
      store.addEntry({ title: "Rainy day", content: "Stayed inside", mood: Mood.SAD });
      store.addEntry({ title: "Deadline stress", content: "Too much work", mood: Mood.STRESSED });
      return store;
    }

    it("returns all entries when no filters are given", () => {
      expect(seeded().filterEntries()).toHaveLength(3);
    });

    it("filters by mood", () => {
      const results = seeded().filterEntries(Mood.SAD);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Rainy day");
    });

    it("filters by search query matching the title, case-insensitively", () => {
      const results = seeded().filterEntries(undefined, "MORNING");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Morning run");
    });

    it("filters by search query matching the content", () => {
      const results = seeded().filterEntries(undefined, "too much");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Deadline stress");
    });

    it("combines mood and search filters", () => {
      const results = seeded().filterEntries(Mood.STRESSED, "deadline");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Deadline stress");
    });

    it("returns an empty array when nothing matches", () => {
      expect(seeded().filterEntries(Mood.HAPPY)).toEqual([]);
    });
  });

  describe("getStats", () => {
    it("returns zero total and null mood for an empty journal", () => {
      const store = new JournalStore();
      expect(store.getStats()).toEqual({ total: 0, mostFrequentMood: null });
    });

    it("reports the total entry count", () => {
      const store = new JournalStore();
      store.addEntry({ title: "One", mood: Mood.HAPPY });
      store.addEntry({ title: "Two", mood: Mood.HAPPY });
      expect(store.getStats().total).toBe(2);
    });

    it("reports the most frequent mood", () => {
      const store = new JournalStore();
      store.addEntry({ title: "One", mood: Mood.HAPPY });
      store.addEntry({ title: "Two", mood: Mood.SAD });
      store.addEntry({ title: "Three", mood: Mood.HAPPY });
      expect(store.getStats().mostFrequentMood).toBe(Mood.HAPPY);
    });
  });
});
