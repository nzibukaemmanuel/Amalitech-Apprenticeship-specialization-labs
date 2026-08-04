/**
 * Central type definitions for the Journal App.
 * Every other module imports its data contracts from here.
 */

export enum Mood {
  HAPPY = "HAPPY",
  SAD = "SAD",
  MOTIVATED = "MOTIVATED",
  STRESSED = "STRESSED",
  CALM = "CALM",
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood: Mood;
  timestamp: number;
  editedAt?: number;
}

export type Journal = JournalEntry[];

// Utility-type driven helpers built on top of JournalEntry.
export type NewEntryInput = Omit<JournalEntry, "id" | "timestamp">;
export type EntryUpdate = Partial<Omit<JournalEntry, "id">>;
export type EntryPreview = Pick<JournalEntry, "id" | "title" | "mood" | "timestamp">;

export interface MoodMeta {
  label: string;
  emoji: string;
  className: string;
}

export const MOOD_META: Record<Mood, MoodMeta> = {
  [Mood.HAPPY]: { label: "Happy", emoji: "😊", className: "mood-happy" },
  [Mood.SAD]: { label: "Sad", emoji: "😔", className: "mood-sad" },
  [Mood.MOTIVATED]: { label: "Motivated", emoji: "🚀", className: "mood-motivated" },
  [Mood.STRESSED]: { label: "Stressed", emoji: "😣", className: "mood-stressed" },
  [Mood.CALM]: { label: "Calm", emoji: "🍃", className: "mood-calm" },
};

export interface JournalStats {
  total: number;
  mostFrequentMood: Mood | null;
}
