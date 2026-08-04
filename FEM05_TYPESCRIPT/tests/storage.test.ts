import { describe, it, expect, beforeEach } from "vitest";
import { loadJournal, saveJournal } from "../src/storage";
import { Mood, type JournalEntry } from "../src/types";

const STORAGE_KEY = "journal-app:entries";

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "id-1",
    title: "My day",
    content: "It was fine.",
    mood: Mood.CALM,
    timestamp: 1700000000000,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadJournal", () => {
  it("returns an empty array when nothing is stored", () => {
    expect(loadJournal()).toEqual([]);
  });

  it("returns an empty array when the stored value is not valid JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadJournal()).toEqual([]);
  });

  it("returns an empty array when the stored value is not an array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadJournal()).toEqual([]);
  });

  it("round-trips entries saved via saveJournal", () => {
    const entry = makeEntry();
    saveJournal([entry]);
    expect(loadJournal()).toEqual([entry]);
  });

  it("filters out entries with an invalid mood", () => {
    const valid = makeEntry({ id: "valid" });
    const invalidMood = { ...makeEntry({ id: "invalid" }), mood: "NOT_A_MOOD" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([valid, invalidMood]));
    expect(loadJournal()).toEqual([valid]);
  });

  it("filters out entries missing required fields", () => {
    const valid = makeEntry({ id: "valid" });
    const missingTitle = { ...makeEntry({ id: "missing" }), title: undefined };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([valid, missingTitle]));
    expect(loadJournal()).toEqual([valid]);
  });

  it("filters out non-object entries", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([makeEntry(), "oops", 42, null]));
    expect(loadJournal()).toEqual([makeEntry()]);
  });

  it("accepts entries with an optional editedAt", () => {
    const entry = makeEntry({ editedAt: 1700000500000 });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry]));
    expect(loadJournal()).toEqual([entry]);
  });
});

describe("saveJournal", () => {
  it("persists the journal as JSON under the storage key", () => {
    const entries = [makeEntry({ id: "a" }), makeEntry({ id: "b" })];
    saveJournal(entries);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(entries);
  });

  it("overwrites any previously stored journal", () => {
    saveJournal([makeEntry({ id: "old" })]);
    saveJournal([makeEntry({ id: "new" })]);
    expect(loadJournal()).toEqual([makeEntry({ id: "new" })]);
  });
});
