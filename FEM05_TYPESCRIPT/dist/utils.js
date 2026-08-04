/**
 * Reusable, generic utility functions shared across the app.
 */
/**
 * Finds the first item in `list` whose `key` property equals `value`.
 * The <T> generic + `keyof T` constraint means the compiler rejects any
 * property name that doesn't actually exist on T, at compile time —
 * a typo like findByProperty(entries, "titel", ...) fails to build
 * instead of silently returning undefined at runtime.
 */
export function findByProperty(list, key, value) {
    return list.find((item) => item[key] === value);
}
/**
 * Generates a reasonably unique id without relying on external packages.
 */
export function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
/**
 * Formats a unix timestamp (ms) into a human-readable date + time string.
 */
export function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
/**
 * Truncates text to `maxLength` characters, adding an ellipsis when cut.
 */
export function truncate(text, maxLength) {
    if (text.length <= maxLength)
        return text;
    return `${text.slice(0, maxLength).trimEnd()}…`;
}
/**
 * Escapes HTML-significant characters so user-authored content can be
 * safely interpolated into template-literal markup without enabling
 * script injection.
 */
export function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
}
/**
 * Debounces a function so it only runs after `delay` ms of inactivity —
 * used to avoid re-rendering on every single keystroke in the search box.
 */
export function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        if (timeoutId !== undefined)
            clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
//# sourceMappingURL=utils.js.map