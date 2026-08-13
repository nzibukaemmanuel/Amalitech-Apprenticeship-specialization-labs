import { describe, it, expect, vi, beforeEach } from "vitest";
import { initUI, renderEntries, renderStats, resetForm, showToast, type UICallbacks } from "../src/ui";
import { Mood, type JournalEntry } from "../src/types";

// jsdom does not implement scrollIntoView; ui.ts calls it when entering edit mode.
HTMLElement.prototype.scrollIntoView = vi.fn();

function buildFixture(): void {
  document.body.innerHTML = `
    <form id="entry-form">
      <input id="entry-title" />
      <textarea id="entry-content"></textarea>
      <span id="char-count"></span>
      <div id="mood-selector"></div>
      <h2 id="form-heading"></h2>
      <button id="submit-button" type="submit"></button>
      <button id="cancel-edit-button" type="button"></button>
    </form>
    <select id="mood-filter"><option value=""></option></select>
    <input id="search-input" />
    <div id="entries-list"></div>
    <div id="empty-state" hidden></div>
    <div id="stats-bar"></div>
    <div id="toast-container"></div>
  `;
}

function makeCallbacks(overrides: Partial<UICallbacks> = {}): UICallbacks {
  return {
    onSubmit: vi.fn(),
    onDelete: vi.fn(),
    onEditRequest: vi.fn(),
    onFilterChange: vi.fn(),
    onCancelEdit: vi.fn(),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: "entry-1",
    title: "A title",
    content: "Some content",
    mood: Mood.HAPPY,
    timestamp: Date.UTC(2024, 0, 1, 9, 0),
    ...overrides,
  };
}

beforeEach(() => {
  buildFixture();
});

// initUI() caches DOM refs but leaves selectedMood/editingId as module-level
// state from any prior test; resetForm() clears both back to a clean slate.
function setupUI(callbacks: UICallbacks): UICallbacks {
  initUI(callbacks);
  resetForm();
  return callbacks;
}

describe("initUI", () => {
  it("builds one mood pill per mood", () => {
    setupUI(makeCallbacks());
    const pills = document.querySelectorAll("#mood-selector .mood-pill");
    expect(pills).toHaveLength(Object.keys(Mood).length);
  });

  it("builds one filter option per mood, in addition to the placeholder", () => {
    setupUI(makeCallbacks());
    const options = document.querySelectorAll("#mood-filter option");
    expect(options).toHaveLength(Object.keys(Mood).length + 1);
  });

  it("marks a mood pill active and aria-pressed when clicked", () => {
    setupUI(makeCallbacks());
    const pill = document.querySelector<HTMLButtonElement>(`[data-mood="${Mood.SAD}"]`)!;
    pill.click();

    expect(pill.classList.contains("mood-pill--active")).toBe(true);
    expect(pill.getAttribute("aria-pressed")).toBe("true");
  });

  it("blocks submit and shows an error toast when no mood is selected", () => {
    const callbacks = makeCallbacks();
    setupUI(callbacks);

    document.getElementById("entry-form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );

    expect(callbacks.onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector(".toast--error")).toBeTruthy();
  });

  it("calls onSubmit with the form values when a mood is selected", () => {
    const callbacks = makeCallbacks();
    setupUI(callbacks);

    (document.getElementById("entry-title") as HTMLInputElement).value = "My title";
    (document.getElementById("entry-content") as HTMLTextAreaElement).value = "My content";
    document.querySelector<HTMLButtonElement>(`[data-mood="${Mood.CALM}"]`)!.click();

    document.getElementById("entry-form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );

    expect(callbacks.onSubmit).toHaveBeenCalledWith(
      { title: "My title", content: "My content", mood: Mood.CALM },
      null
    );
  });

  it("calls onCancelEdit and resets the form when the cancel button is clicked", () => {
    const callbacks = makeCallbacks();
    setupUI(callbacks);

    document.getElementById("cancel-edit-button")!.click();

    expect(callbacks.onCancelEdit).toHaveBeenCalledTimes(1);
    expect((document.getElementById("cancel-edit-button") as HTMLButtonElement).hidden).toBe(true);
  });

  it("calls onFilterChange when the mood filter changes", () => {
    const callbacks = makeCallbacks();
    setupUI(callbacks);

    const select = document.getElementById("mood-filter") as HTMLSelectElement;
    select.value = Mood.MOTIVATED;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(callbacks.onFilterChange).toHaveBeenCalledWith(Mood.MOTIVATED, "");
  });

  it("calls onFilterChange when the search input changes", () => {
    const callbacks = makeCallbacks();
    setupUI(callbacks);

    const search = document.getElementById("search-input") as HTMLInputElement;
    search.value = "hello";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect(callbacks.onFilterChange).toHaveBeenCalledWith(undefined, "hello");
  });

  it("updates the character count as content is typed", () => {
    setupUI(makeCallbacks());
    const content = document.getElementById("entry-content") as HTMLTextAreaElement;
    content.value = "12345";
    content.dispatchEvent(new Event("input", { bubbles: true }));

    expect(document.getElementById("char-count")!.textContent).toBe("5 characters");
  });

  describe("entries list delegation", () => {
    function appendCard(): void {
      const list = document.getElementById("entries-list")!;
      list.innerHTML = `
        <article data-entry-id="entry-1" class="entry-card">
          <button data-action="edit">Edit</button>
          <button data-action="delete">Delete</button>
          <button data-action="toggle">Toggle</button>
        </article>
      `;
    }

    it("calls onEditRequest and enters edit mode when the edit action is clicked", () => {
      const entry = makeEntry();
      const callbacks = makeCallbacks({ onEditRequest: vi.fn().mockReturnValue(entry) });
      setupUI(callbacks);
      appendCard();

      document.querySelector<HTMLButtonElement>("[data-action='edit']")!.click();

      expect(callbacks.onEditRequest).toHaveBeenCalledWith("entry-1");
      expect((document.getElementById("entry-title") as HTMLInputElement).value).toBe(entry.title);
      expect(document.getElementById("form-heading")!.textContent).toBe("Edit entry");
    });

    it("toggles the expanded class when the toggle action is clicked", () => {
      setupUI(makeCallbacks());
      appendCard();
      const card = document.querySelector<HTMLElement>("[data-entry-id]")!;

      document.querySelector<HTMLButtonElement>("[data-action='toggle']")!.click();
      expect(card.classList.contains("entry-card--expanded")).toBe(true);

      document.querySelector<HTMLButtonElement>("[data-action='toggle']")!.click();
      expect(card.classList.contains("entry-card--expanded")).toBe(false);
    });

    it("calls onDelete only after the removal animation finishes", () => {
      const callbacks = makeCallbacks();
      setupUI(callbacks);
      appendCard();
      const card = document.querySelector<HTMLElement>("[data-entry-id]")!;

      document.querySelector<HTMLButtonElement>("[data-action='delete']")!.click();
      expect(card.classList.contains("entry-card--removing")).toBe(true);
      expect(callbacks.onDelete).not.toHaveBeenCalled();

      card.dispatchEvent(new Event("animationend"));
      expect(callbacks.onDelete).toHaveBeenCalledWith("entry-1");
    });
  });
});

describe("renderEntries", () => {
  it("shows the empty state and clears the list when there are no entries", () => {
    setupUI(makeCallbacks());
    renderEntries([]);

    expect(document.getElementById("empty-state")!.hidden).toBe(false);
    expect(document.getElementById("entries-list")!.children).toHaveLength(0);
  });

  it("renders a card per entry and hides the empty state", () => {
    setupUI(makeCallbacks());
    renderEntries([makeEntry({ id: "1" }), makeEntry({ id: "2", title: "Second" })]);

    expect(document.getElementById("empty-state")!.hidden).toBe(true);
    const cards = document.querySelectorAll("[data-entry-id]");
    expect(cards).toHaveLength(2);
    expect(cards[1].querySelector(".entry-card__title")!.textContent).toBe("Second");
  });

  it("escapes entry title and content to prevent script injection", () => {
    setupUI(makeCallbacks());
    renderEntries([makeEntry({ title: "<img src=x onerror=alert(1)>" })]);

    const card = document.querySelector("[data-entry-id]")!;
    expect(card.innerHTML).not.toContain("<img");
    expect(card.querySelector(".entry-card__title")!.textContent).toBe("<img src=x onerror=alert(1)>");
  });

  it("shows a last-edited note only when editedAt is set", () => {
    setupUI(makeCallbacks());
    renderEntries([makeEntry({ editedAt: Date.UTC(2024, 0, 2) })]);

    expect(document.querySelector(".entry-card__edited")).toBeTruthy();
  });

  it("only shows the expand toggle for long entries", () => {
    setupUI(makeCallbacks());
    renderEntries([
      makeEntry({ id: "short", content: "short" }),
      makeEntry({ id: "long", content: "x".repeat(200) }),
    ]);

    const cards = document.querySelectorAll("[data-entry-id]");
    expect(cards[0].querySelector("[data-action='toggle']")).toBeNull();
    expect(cards[1].querySelector("[data-action='toggle']")).toBeTruthy();
  });
});

describe("renderStats", () => {
  it("hides the stats bar when total is zero", () => {
    setupUI(makeCallbacks());
    renderStats({ total: 0, mostFrequentMood: null });

    expect(document.getElementById("stats-bar")!.hidden).toBe(true);
  });

  it("shows the total and most frequent mood", () => {
    setupUI(makeCallbacks());
    renderStats({ total: 4, mostFrequentMood: Mood.HAPPY });

    const bar = document.getElementById("stats-bar")!;
    expect(bar.hidden).toBe(false);
    expect(bar.textContent).toContain("4");
    expect(bar.textContent).toContain("Happy");
  });
});

describe("showToast", () => {
  it("appends a success toast with the given message by default", () => {
    setupUI(makeCallbacks());
    showToast("Saved!");

    const toast = document.querySelector(".toast--success")!;
    expect(toast.textContent).toBe("Saved!");
  });

  it("appends an error toast when the error variant is requested", () => {
    setupUI(makeCallbacks());
    showToast("Oops", "error");

    expect(document.querySelector(".toast--error")!.textContent).toBe("Oops");
  });

  it("marks the toast as leaving after the delay and removes it once the animation ends", () => {
    vi.useFakeTimers();
    setupUI(makeCallbacks());
    showToast("Saved!");
    const toast = document.querySelector(".toast--success")!;

    vi.advanceTimersByTime(2600);
    expect(toast.classList.contains("toast--leaving")).toBe(true);

    toast.dispatchEvent(new Event("animationend"));
    expect(document.querySelector(".toast--success")).toBeNull();

    vi.useRealTimers();
  });
});

describe("resetForm", () => {
  it("clears inputs, mood selection, and restores the compose-mode labels", () => {
    const entry = makeEntry();
    const callbacks = makeCallbacks({ onEditRequest: vi.fn().mockReturnValue(entry) });
    setupUI(callbacks);

    document.getElementById("entries-list")!.innerHTML = `
      <article data-entry-id="entry-1"><button data-action="edit">Edit</button></article>
    `;
    document.querySelector<HTMLButtonElement>("[data-action='edit']")!.click();

    resetForm();

    expect((document.getElementById("entry-title") as HTMLInputElement).value).toBe("");
    expect(document.getElementById("char-count")!.textContent).toBe("0 characters");
    expect(document.getElementById("form-heading")!.textContent).toBe("New entry");
    expect((document.getElementById("cancel-edit-button") as HTMLButtonElement).hidden).toBe(true);
    expect(document.querySelectorAll(".mood-pill--active")).toHaveLength(0);
  });
});
