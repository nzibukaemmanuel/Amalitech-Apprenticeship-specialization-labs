/**
 * Type-safe persistence layer over localStorage.
 */
import { Mood } from "./types.js";
const STORAGE_KEY = "journal-app:entries";
/**
 * Type guard that validates an unknown value has the exact shape of a
 * JournalEntry. This is what keeps corrupted or hand-edited localStorage
 * data from silently flowing into the app as if it were fully typed —
 * without it, a bad `mood` string or missing field would only surface
 * as a confusing runtime crash deep inside the UI layer.
 */
function isJournalEntry(value) {
    if (typeof value !== "object" || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.id === "string" &&
        typeof candidate.title === "string" &&
        typeof candidate.content === "string" &&
        typeof candidate.timestamp === "number" &&
        Object.values(Mood).includes(candidate.mood) &&
        (candidate.editedAt === undefined || typeof candidate.editedAt === "number"));
}
/**
 * Loads the journal from localStorage. Returns an empty array when there
 * is nothing stored, the value is malformed JSON, or the parsed data does
 * not conform to Journal — the app never has to handle `null` upstream.
 */
export function loadJournal() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        return parsed.filter(isJournalEntry);
    }
    catch {
        return [];
    }
}
/**
 * Persists the full journal to localStorage as JSON.
 */
export function saveJournal(journal) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journal));
}
//# sourceMappingURL=storage.js.map