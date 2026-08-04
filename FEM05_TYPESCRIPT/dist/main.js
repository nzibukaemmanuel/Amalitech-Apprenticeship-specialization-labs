/**
 * Application entry point: wires JournalStore (business logic) to
 * the UI layer (DOM rendering) via plain callbacks.
 */
import { JournalStore } from "./journal.js";
import { initUI, renderEntries, renderStats, resetForm, showToast } from "./ui.js";
const store = new JournalStore();
let activeMoodFilter;
let activeSearchQuery = "";
function refresh() {
    renderEntries(store.filterEntries(activeMoodFilter, activeSearchQuery));
    renderStats(store.getStats());
}
initUI({
    onSubmit: (values, editingId) => {
        try {
            if (editingId) {
                store.editEntry(editingId, values);
                showToast("Entry updated.");
            }
            else {
                store.addEntry(values);
                showToast("Entry saved.");
            }
            resetForm();
            refresh();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Something went wrong.";
            showToast(message, "error");
        }
    },
    onDelete: (id) => {
        const didDelete = store.deleteEntry(id);
        if (didDelete)
            showToast("Entry deleted.");
        refresh();
    },
    onEditRequest: (id) => store.getAll().find((entry) => entry.id === id),
    onFilterChange: (mood, query) => {
        activeMoodFilter = mood;
        activeSearchQuery = query;
        refresh();
    },
    onCancelEdit: () => {
        // Nothing to undo in the store; the UI clears its own form state.
    },
});
refresh();
//# sourceMappingURL=main.js.map