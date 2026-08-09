# Testing Documentation: Task Manager API Client

This document explains, in plain language wherever possible, how this project was tested, what was tested, and what we learned along the way.

---

## 1. Testing Strategy

**Overall approach.** Testing was layered from the smallest pieces outward — the same way you'd check a car: first the individual parts (does the engine turn on by itself?), then how parts work together (does the engine actually turn the wheels?), and finally a full drive around the block.

1. **Unit tests first.** Every class (`Task`, `PriorityTask`, `User`), every pure processing function (`filterByStatus`, `calculateStatistics`, `sortTasks`, etc.), and every supporting utility (the closure-based cache, the concurrency limiter, the custom error types) was tested completely on its own — no network, no other modules involved.
2. **Integration tests second.** Once the individual pieces were trusted, we tested how they cooperate: `APIClient` talking to a (fake, fully controlled) server, and `TaskManager` — this project's orchestrator — running full workflows that fetch data, turn it into real objects, and process it.
3. **Mocks and spies throughout.** Anywhere the real code talks to something slow, unpredictable, or external — a network call, `console.log` — we substituted a stand-in we controlled completely, so tests stay fast (the whole suite runs in about 1.5 seconds) and give the exact same result every single run.

**Why this approach.** Testing small pieces first makes failures easy to pinpoint — if a unit test fails, you know exactly which function is broken instead of guessing across an entire pipeline. Integration tests afterward confirm the pieces actually fit together, which unit tests alone can't guarantee. This project's own `TaskManager` class is a great example: it's the "glue" between `APIClient`, the model classes, and `taskProcessor` — so it's exactly the kind of thing that needs an integration test, not a unit test.

**How we decided what to test.** For every function/method we asked: (1) does it work with normal, expected input? (2) does it work with empty input (empty arrays, no tasks, no users)? (3) does it fail *safely* with unusual input (missing fields, non-array API responses)? (4) are there special edge cases unique to this piece of logic (e.g., "what does overdue mean if there's no due date at all?", "does the cache actually prevent a second network call?")?

**A technical note on how testing was wired up:** this project's source code uses native ES modules (`"type": "module"` in `package.json`, `import`/`export` syntax) rather than the older CommonJS style. Jest's default engine expects CommonJS, so `babel-jest` was added purely as a **testing-time translator** — it converts the modern `import`/`export` syntax into the older style only while tests run, invisibly, without changing a single line of the original source files. `babel.config.cjs` and `jest.config.cjs` configure this. This means `npm start` and `npm run web` still run your original source files completely unchanged.

---

## 2. Test Types Implemented

### Unit Tests (111 test cases)

| Target | File | What's covered |
|---|---|---|
| `Task` class | `tests/unit/models.test.js` | Constructor validation (`TypeError` on missing id/title), `toggle()`, `getStatus()`, always-false `isOverdue()`, `toJSON()` |
| `PriorityTask` class | `tests/unit/models.test.js` | Inheritance from `Task`, the `priorityWeight` getter, overridden `getStatus()`/`isOverdue()`/`toJSON()`, default priority/due-date handling |
| `User` class | `tests/unit/models.test.js` | `addTask()` chaining, `getCompletionRate()` (including the empty-list divide-by-zero case and rounding), `getTasksByStatus()`, `toJSON()` |
| Data processing functions | `tests/unit/taskProcessor.test.js` | `filterByStatus`, `filterByUser`, `filterByPriority`, `searchTasks`, `calculateStatistics`, `groupByUser`, `extractUniquePriorities`, `sortTasks` plus its three comparators (`byPriorityDesc`, `byTitleAsc`, `byCompletedFirst`) |
| Cache / rate limiter / errors | `tests/unit/utils.test.js` | `createCache`/`withCache` memoization, `runWithConcurrencyLimit`'s ordering and concurrency cap, `APIError`/`ValidationError` construction |
| Spy-based tests | `tests/unit/utils.test.js` | See "Mocks & Spies" below |

**Rationale for test selection:** the model classes and `taskProcessor` functions hold this project's actual business rules (what counts as overdue, how completion rate rounds, how multi-criteria sorting resolves ties), so they got the deepest coverage. The cache and rate limiter are less "business logic" and more "infrastructure," but they have subtle correctness requirements (never exceed the concurrency limit, never call the wrapped function twice for the same key) that are easy to break silently, so they were tested just as thoroughly.

### Integration Tests (29 test cases)

| File | Module interactions tested |
|---|---|
| `tests/integration/api.test.js` | `APIClient` (with its real private `#request`/`#fetchUsersRaw` methods) talking to a mocked global `fetch` — success responses, 404/500 errors, dead network connections, malformed JSON, non-array response bodies, the built-in per-endpoint caching, `fetchAll()`'s `Promise.all` concurrency, the plain-Promise-chain `fetchUsersPromiseStyle()` variant, and the rate-limited `fetchTodosForUsers()` |
| `tests/integration/dataFlow.test.js` | Complete workflows through `TaskManager`: mocked API → real `PriorityTask`/`User` objects → `taskProcessor` functions → final output, including a real file written to disk via `exportToJSON()` |

**Mocking strategy:** tests never touch the real internet. `global.fetch` was replaced with `jest.fn()`, and we scripted exactly what it should return (`mockResolvedValue`, or a custom implementation keyed off the requested URL) or fail with (`mockRejectedValue`) for each scenario. A separate `tests/__mocks__/api.js` provides realistic sample user/todo data and a `MockAPIClient` matching the real `APIClient`'s method names, for use in future workflow tests.

**Complete workflows tested (8, across `dataFlow.test.js`):**
1. `load()` fetches users+todos and correctly attaches each todo to its owning `User`.
2. `getStatistics()` on real loaded data matches calling `calculateStatistics()` directly.
3. `search()` and `getTasksByUser()` work correctly against real `PriorityTask` instances built from API data.
4. A server error during `load()` propagates as an `APIError`, leaving `tasks`/`users` empty rather than partially populated.
5. A full pipeline from mocked API through `exportToJSON()` to a real JSON file on disk, then read back and verified.
6. `fetchTodosPerUser()` (the rate-limited bonus feature) driven end-to-end from real loaded users, with an explicit concurrency value.
6b. The same feature falling back correctly to its default concurrency of 3 when called with no arguments.
7. `exportToJSON()` falling back to safe empty defaults when called with no data object at all.

### Mocks & Spies

- **What was mocked:** the global `fetch` function (no real network calls ever happen during tests), and a full `MockAPIClient` with realistic sample data for future use.
- **What was spied on:** individual methods on real objects (`task.toggle()`, a `PriorityTask`'s `isOverdue()` being called internally by its own `getStatus()`), built-in `Array.prototype` methods (`filter`, `sort`) to confirm `calculateStatistics()` and `sortTasks()` actually use them internally, the cache's own `get()` method to prove it's consulted on every call, and all three `console` methods (`log`, `warn`, `error`) to check logging behavior without ever printing to the real terminal during a test run.
- **Justification:** mocking the network keeps tests fast and 100% repeatable — a real server being briefly slow or offline should never make the test suite randomly fail. Spying on the cache is what actually *proves* the memoization works (rather than just trusting the code), and spying on console output verifies logging behavior invisibly.

---

## 3. Test Coverage Analysis

Coverage was generated by running:

```
npx jest --coverage
```

Because this environment doesn't have a GUI to screenshot, here is the **actual, real coverage table produced by that command** (not a mock-up):

```
------------------|---------|----------|---------|---------|-------------------
File              | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------------|---------|----------|---------|---------|-------------------
All files         |     100 |      100 |     100 |     100 |
 api.js           |     100 |      100 |     100 |     100 |
 cache.js         |     100 |      100 |     100 |     100 |
 errors.js        |     100 |      100 |     100 |     100 |
 exporter.js      |     100 |      100 |     100 |     100 |
 models.js        |     100 |      100 |     100 |     100 |
 rateLimiter.js   |     100 |      100 |     100 |     100 |
 taskManager.js   |     100 |      100 |     100 |     100 |
 taskProcessor.js |     100 |      100 |     100 |     100 |

Test Suites: 6 passed, 6 total
Tests:       142 passed, 142 total
```

**Overall coverage vs. targets:**

| Metric | Target | Achieved |
|---|---|---|
| Statement coverage | 80% | **100%** |
| Branch coverage | 75% | **100%** |
| Function coverage | 85% | **100%** |
| Line coverage | 80% | **100%** |

Every tested source file reaches full coverage on every metric.

**Intentionally excluded from coverage collection (with justification):**

| File | Why it's excluded |
|---|---|
| `src/main.js` | The Node CLI — almost entirely `readline` prompts and a `switch` menu driving user I/O. There is essentially no independent business logic here; everything it calls (`TaskManager`, `taskProcessor`, `exportToJSON`) is already fully tested. Testing the CLI itself would mean simulating keyboard input, which tests the terminal-interaction plumbing, not the application's correctness. |
| `app.js` | The browser entry point — direct DOM manipulation (`document.getElementById`, `innerHTML`, click handlers). Meaningfully testing this needs a browser-like environment (e.g. jsdom) and was judged out of scope for this Jest/Node unit+integration suite; the logic it calls into (`TaskManager`, `taskProcessor`) is fully covered. |
| `server.js` | A static file server — pure infrastructure (serving files over `http`), not business logic. |

This mirrors a common, deliberate real-world coverage decision: **100% coverage of testable business logic**, with thin I/O/UI wrapper layers explicitly and visibly excluded rather than either (a) leaving them uncovered silently or (b) writing low-value tests that mock `readline` or the DOM just to move a number.

---

## 4. Challenges & Solutions

**Challenge 1: Getting Jest to run this project's native ES modules at all.**
This project's `package.json` sets `"type": "module"` and every source file uses `import`/`export`. Jest's default transform pipeline expects the older CommonJS (`require`/`module.exports`) style, and Node's own experimental flag for ESM support in Jest (`--experimental-vm-modules`) prints an "ExperimentalWarning" to the console every run — which would have violated the requirement that `npm test` produce no warnings. *Solution:* `babel-jest` plus `@babel/preset-env` were added as dev dependencies purely to translate `import`/`export` into `require`/`module.exports` **on the fly, for tests only** — the real source files on disk are completely untouched, and `npm start`/`npm run web` still run the original native-ESM code. Config files were named `babel.config.cjs` and `jest.config.cjs` (rather than plain `.js`) specifically so Node always treats them as CommonJS regardless of the project-wide `"type": "module"` setting. *Lesson:* modern JavaScript tooling has more than one "flavor" of module system in play at once, and getting them to cooperate is itself a real, common setup task — not just filler configuration.

**Challenge 2: A mock URL-matching order bug — one I actually made and then had to catch.**
While writing the integration test for `fetchTodosForUsers()` (the rate-limited per-user fetch), the mock `fetch` handler checked `url.endsWith('/todos')` *before* checking the more specific `/users/:id/todos` pattern. Because a URL like `.../users/1/todos` **also** ends with the string `/todos`, the generic "give me everyone's todos" branch was silently intercepting requests meant for one specific user — the test still ran and produced a result, it just quietly checked the wrong thing (until a `toHaveLength()` assertion caught the mismatch). *Solution:* reordered the mock handler to check the more specific pattern first, and repeated the same fix in a second, near-identical test where the same mistake had been copy-pasted. *Lesson:* this is a great real-world example of why assertions matter even when a test "runs fine" — a test with no assertions, or with weak ones, would have passed while silently testing the wrong endpoint the whole time. It's also a reminder to order URL-matching logic from most-specific to least-specific, in both test mocks and real code.

**Challenge 3: Proving a concurrency *limit* actually holds, not just that the final result is correct.**
`runWithConcurrencyLimit()` and `APIClient.fetchTodosForUsers()` are supposed to cap how many requests are ever "in flight" at once — but a naive test could easily get the right final answer even if the cap were silently ignored (e.g. if it fired all requests at once and they just happened to finish in order). *Solution:* the test tracks `active`/`maxActive` counters that increment when a mock worker starts and decrement when it finishes (with a small artificial `setTimeout` delay in between so overlaps are actually possible), then asserts `maxActive` never exceeded the configured limit — directly testing the *behavior* the feature promises, not just its output. *Lesson:* for anything about timing, ordering, or concurrency, the test needs to be deliberately constructed to make a violation observable — otherwise it's easy to write a test that passes today and would keep passing even if the underlying guarantee silently broke.

---

## 5. Key Learnings

**About unit testing:** testing one small piece at a time makes it obvious *exactly* where a bug lives. A unit test failure in `models.test.js` points at one specific method; there's no need to trace through the whole application to find the problem.

**About integration testing:** individually-correct pieces can still fail when combined. `TaskManager.load()` is a good example — `APIClient`, `PriorityTask`, `User`, and `taskProcessor` can each be perfect on their own and a workflow can still break if, say, todos aren't attached to the right user. Integration tests are what actually prove the wiring is correct.

**About mocking and spying:** mocking isn't about avoiding testing the real thing — it's about testing *your* code's reaction to situations (a 500 error, a dropped connection, a non-array response body) that would be slow, unreliable, or simply impossible to trigger against a real server on demand. Spies go one step further: they let you verify *how* code behaves internally (which methods it calls, how many times, with what) rather than just checking its final return value — which is exactly what proved the cache was actually working, not just returning the right numbers by coincidence.

**How testing improved code quality:** writing these tests didn't surface bugs in the *application* code (it was already solid), but it did surface a bug in the *test* code itself (Challenge 2 above) — which is its own valuable lesson: tests need scrutiny too, and a passing test suite is only as trustworthy as the assertions inside it.

**Best practices discovered:**
- Always test the empty-input case (`[]`, no tasks, no users) — it's the most commonly forgotten scenario and usually the first thing to break in production.
- When mocking a URL router, always check the most specific pattern first — generic `endsWith`/`includes` checks can silently swallow more specific ones.
- For anything involving concurrency or timing guarantees, write the test to make a *violation* observable (track a running counter), not just to check the final output.
- Keep the real, original test approach around alongside the new one when refactoring a project's testing setup — `test:legacy` still runs this project's original hand-written smoke and integration scripts unchanged, so nothing that used to work is silently lost.

---

## 6. Differences Between Test Types

**Unit tests** check one function or class completely in isolation, with every dependency faked or removed. They're fast (this project's whole suite runs in about 1.5 seconds) and pinpoint failures precisely. *Example from this project:* `PriorityTask.isOverdue()` tested purely on its own, feeding it different due dates directly — no API, no `TaskManager`, no other class involved.

**Integration tests** check that two or more pieces of *your own* code work correctly together, usually with only the truly external dependency (the real network) faked. *Example from this project:* `dataFlow.test.js`'s Workflow 1, which fetches (mocked) users and todos, has `TaskManager.load()` build real `PriorityTask` and `User` objects from them, and checks that each task ended up attached to the right owner — exercising four real modules (`APIClient`, `PriorityTask`, `User`, `TaskManager`) together.

**End-to-end (E2E) tests** — not included in this suite, but worth defining for completeness — check the *entire* real system as a user would actually experience it: the real JSONPlaceholder API (not mocked), a real browser loading `app.js` and `index.html`, a person actually clicking the "Toggle" button. They're the slowest and most fragile kind of test (a real API being briefly slow would make them flaky), but the only kind that can catch "it works against my mock but not the real service" problems — this project's `npm start` and `npm run web` are effectively manual E2E checks against the real JSONPlaceholder API.

**When to use each:**
- Use **unit tests** for anything with real logic — calculations, validation rules, conditional branching. Write lots of these; they're cheap, fast, and precise. `models.js` and `taskProcessor.js` are exactly this kind of code.
- Use **integration tests** wherever two of your own modules hand data to each other, especially at a boundary with something external. `TaskManager` orchestrating `APIClient` + models + `taskProcessor` is exactly this kind of code.
- Use **E2E tests** sparingly, for the handful of most critical real user journeys, because they're expensive to write, slow to run, and can fail for reasons that have nothing to do with a bug in your code (e.g. the real JSONPlaceholder API being temporarily down).

---

## Appendix: Project Structure

```
TaskManagerAPI/
├── package.json                     # npm scripts + devDependencies (updated)
├── babel.config.cjs                 # NEW - lets Jest understand this project's ES modules
├── jest.config.cjs                  # NEW - Jest settings + coverage thresholds
├── TESTING_DOCUMENTATION.md          # This file
├── README.md                         # Original project README (untouched)
├── app.js, index.html, styles.css, server.js   # Original browser UI (untouched)
├── src/
│   ├── models.js                    # Task, PriorityTask, User (untouched)
│   ├── taskProcessor.js             # Pure filter/search/stats/sort functions (untouched)
│   ├── api.js                       # APIClient (untouched)
│   ├── cache.js                     # Closure-based memoization cache (untouched)
│   ├── rateLimiter.js               # Concurrency limiter (untouched)
│   ├── errors.js                    # APIError / ValidationError (untouched)
│   ├── exporter.js                  # JSON export (untouched)
│   ├── taskManager.js               # TaskManager orchestrator (untouched)
│   └── main.js                      # Node CLI (untouched, excluded from coverage - see §3)
└── tests/
    ├── setup.test.js                 # NEW - 2 tests, confirms Jest+Babel load ES modules correctly
    ├── smoke-test.js                 # Original hand-written tests (untouched, still runs via `test:legacy`)
    ├── integration-test.js           # Original hand-written tests (untouched, still runs via `test:legacy`)
    ├── unit/
    │   ├── models.test.js             # NEW - 48 tests
    │   ├── taskProcessor.test.js      # NEW - 37 tests
    │   └── utils.test.js              # NEW - 26 tests (includes 10 spy-based tests)
    ├── integration/
    │   ├── api.test.js                # NEW - 21 tests
    │   └── dataFlow.test.js           # NEW - 8 tests
    └── __mocks__/
        └── api.js                     # NEW - sample data + MockAPIClient for future use
```

**Total: 142 new Jest test cases, all passing, 100% coverage on every tested source file.**

No source files in `src/` were modified — every test was written against the project exactly as it already existed.
