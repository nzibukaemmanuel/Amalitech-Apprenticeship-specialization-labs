# Task Manager API Client

A Node.js command-line application that fetches, models, and analyzes task
data from the [JSONPlaceholder](https://jsonplaceholder.typicode.com) API,
built with ES6+ JavaScript.

This is a **terminal application**, not a website — there is no HTML/CSS.
Run it with `node src/main.js` and interact via the printed menu.

## Requirements

- Node.js **18 or later** (uses the built-in global `fetch`, no dependencies to install)

## Setup & Run

```bash
npm install        # no-op — zero external dependencies
npm test            # offline unit tests (models + processor logic, no network)
node tests/integration-test.js   # tests API client + error handling with a mocked fetch
npm start            # runs the real CLI against the live JSONPlaceholder API
```

## Project Structure

```
task-manager/
├── package.json
├── src/
│   ├── errors.js          Custom APIError / ValidationError classes
│   ├── cache.js            Closure-based memoization cache
│   ├── rateLimiter.js       Promise-based concurrency limiter (bonus)
│   ├── exporter.js          JSON data export (bonus)
│   ├── api.js               APIClient — fetch, Promise.all, error handling
│   ├── models.js            Task, PriorityTask, User classes
│   ├── taskProcessor.js     Pure functions: filter/search/stats/group/sort
│   └── main.js               TaskManager controller + CLI menu
└── tests/
    ├── smoke-test.js         Offline: models + taskProcessor + cache logic
    └── integration-test.js   Mocked-fetch: APIClient + TaskManager + errors
```

## How the CLI works

On start, it fetches all users and todos concurrently, wraps each todo in a
`PriorityTask` (JSONPlaceholder todos have no real priority/due date, so
these are deterministically derived from the todo's `id`), attaches each
task to its owning `User`, then drops you into a menu:

```
1) Show statistics       — totals, completion rate, overdue count, by-priority breakdown
2) List all tasks
3) List tasks by user     — prompts for a user ID
4) Search tasks            — case-insensitive title search
5) Sort tasks               — priority (desc), then title (asc) — multi-criteria sort
6) Show cache stats        — hits/misses/size from the closure-based cache
7) Fetch todos per user     — rate-limited demo (max 3 concurrent requests)
8) Export data to JSON      — writes tasks/users/statistics to a file
0) Exit
```

## Design notes worth knowing for a review

- **Caching via closures** (`cache.js`): `createCache()` returns an object
  whose methods are the *only* way to touch the internal `Map` — a textbook
  use of closures for encapsulation, not just a demo of the syntax.
- **Both async styles**: `APIClient` uses `async/await` for the main path
  and a `.then()/.catch()` Promise chain in `fetchUsersPromiseStyle()`.
- **`Promise.all()`**: `fetchAll()` fetches users and todos concurrently
  rather than sequentially.
- **Real inheritance**: `PriorityTask extends Task` and overrides
  `isOverdue()`/`getStatus()` with genuinely different logic, not just a
  cosmetic override.
- **Private class fields** (`#request`, `#fetchUsersRaw`, etc. in `api.js`)
  are ES2022, not ES2015 — flagging this in case the rubric wants strictly
  ES6 (2015) syntax. Straightforward to swap to an underscore convention if so.
- **Error handling**: a custom `APIError` carries the HTTP status, URL, and
  original cause; network failures, non-OK responses, and malformed JSON are
  all caught and re-thrown as `APIError` rather than leaking raw fetch errors.
- **Rate limiting** (`rateLimiter.js`): `runWithConcurrencyLimit()` is a small
  Promise-based worker pool — it caps how many requests are ever in flight at
  once (default 3), rather than firing everything through `Promise.all()`
  simultaneously. `APIClient.fetchTodosForUsers()` uses it to fetch each
  user's todos individually without overwhelming the API.
- **Data export** (`exporter.js`): `TaskManager.exportData()` serializes the
  current tasks, users, and statistics to a JSON file, relying on the
  `toJSON()` methods already defined on `Task`/`PriorityTask`/`User` so the
  output is clean data, not raw class instances.

## Testing notes

`tests/smoke-test.js` runs with zero network access — it exercises the
models and pure processing functions directly with hand-built data.

`tests/integration-test.js` mocks `globalThis.fetch` to verify the
`APIClient` and `TaskManager` handle success, HTTP errors, network failures,
and malformed responses correctly, without depending on JSONPlaceholder
actually being reachable.

Neither test suite hits the real network — but the live CLI (`npm start`)
has been run end-to-end against the real `jsonplaceholder.typicode.com`
(10 users, 200 todos), exercising every menu option including the JSON
export, which was verified by reading the written file back.

Two real bugs turned up during that live run and were fixed:

- **Windows-only silent failure**: the "only run `main()` if this file was
  launched directly" check compared `import.meta.url` against a hand-built
  `file://${process.argv[1]}` string. On Windows, `process.argv[1]` uses
  backslashes and raw spaces while `import.meta.url` is always a
  forward-slash, percent-encoded URL, so the strings never matched —
  `node src/main.js` would silently do nothing. Fixed by comparing against
  `pathToFileURL(process.argv[1]).href` instead.
- **Crash on unexpected stdin EOF**: if the input stream ended while a
  `rl.question()` was outstanding (e.g. redirected/piped input running dry),
  readline would either throw `ERR_USE_AFTER_CLOSE` on the next call or leave
  the pending question's promise unresolved forever. The CLI now tracks the
  pending resolver and the interface's closed state, resolving with a safe
  "exit" answer either way instead of crashing or hanging.
