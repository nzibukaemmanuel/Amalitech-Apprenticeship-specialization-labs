# Marginalia — Note Taking App

A fully client-side vanilla JS note-taking app: DOM manipulation, event
delegation, `localStorage`/`sessionStorage`, and the Geolocation API — no
backend, no build step.

## Run it

Because it uses ES6 modules, open it through a local server rather than
`file://` (modules are blocked by CORS on `file://` in most browsers).

```bash
cd note-taking-app
python3 -m http.server 8000
# then open http://localhost:8000
```

(Or the VS Code "Live Server" extension, or `npx serve`.)

## Where things live

| File | Responsibility |
|---|---|
| `js/storage.js` | All `localStorage`/`sessionStorage` reads & writes (notes, preferences, drafts). Only place that touches Web Storage. |
| `js/noteManager.js` | `Note` class + in-memory notes array; create/update/delete/search/filter. Persists via `storage.js` after every mutation. |
| `js/ui.js` | Pure rendering: note cards, tag sidebar, validation messages, toasts. Never touches storage. |
| `js/themes.js` | Applies/persists color theme (light/dark) and font family (sans/serif/mono). |
| `js/main.js` | Wires it all together: state (current filter/tag/search/editing note), event listeners, event delegation, keyboard/focus handling. |

## Features implemented

- **CRUD**: create, edit (modal), archive/unarchive, delete (with confirm dialog), all synced to `localStorage`.
- **Tags**: comma-separated tag input, deduped, colored "spine" per tag (stable color derived from tag name), sidebar tag filter, click a tag again to clear it.
- **Search**: live filtering across title/content/tags, with match highlighting (`<mark>`).
- **Archive view**: separate "All notes" / "Archived" views with counts.
- **Drafts**: while creating a new note, title/content/tags autosave to `sessionStorage` every 300ms and are restored if you reload or reopen the tab; cleared on successful save.
- **Geolocation (bonus)**: "Add my location" button uses `navigator.geolocation`, attempts reverse geocoding to a city name (falls back to raw coordinates, and handles permission denial/timeouts gracefully).
- **Validation**: title required, min 3 characters, inline error message, submit disabled until valid, validates on blur and on submit.
- **Theme & font system**: light/dark theme and sans/serif/mono font, both applied via a `data-theme`/`data-font` attribute on `<html>` and persisted.
- **Accessibility**: semantic landmarks, skip link, visible focus rings, native `<dialog>` for modals (built-in focus trap + Escape-to-close + focus return), `aria-live` regions for toasts and validation, labelled form fields, keyboard-operable everywhere.
- **Responsive**: CSS grid note layout, collapsible sidebar drawer with scrim on narrow viewports, touch-sized buttons.

## Design notes

The UI takes a "notebook" point of view rather than a generic card grid:
a faint dot-grid backdrop evokes graph paper, each note card carries a
colored left "spine" keyed to its first tag (consistent color per tag name),
and the font switcher (sans/serif/mono) is treated as a real typographic
feature rather than an afterthought — pick "Serif" or "Mono" and the whole
app's voice changes, including the note text itself.

I built this against the project brief since I wasn't able to open the
actual Figma frames (view access needed). If you can export a couple of
key screens as images, I can tighten up colors/spacing/layout to match your
design exactly.
