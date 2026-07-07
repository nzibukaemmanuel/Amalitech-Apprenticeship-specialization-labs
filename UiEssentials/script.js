(() => {
  const textInput = document.getElementById('text-input');
  const excludeSpaces = document.getElementById('exclude-spaces');
  const limitToggle = document.getElementById('limit-toggle');
  const limitInputWrap = document.getElementById('limit-input-wrap');
  const limitInput = document.getElementById('limit-input');
  const limitWarning = document.getElementById('limit-warning');
  const limitExceededCount = document.getElementById('limit-exceeded-count');

  const charCountEl = document.getElementById('char-count');
  const wordCountEl = document.getElementById('word-count');
  const sentenceCountEl = document.getElementById('sentence-count');
  const readingTimeEl = document.getElementById('reading-time');
  const readingTimePlural = document.getElementById('reading-time-plural');

  const densityList = document.getElementById('density-list');
  const densityEmpty = document.getElementById('density-empty');
  const densityToggle = document.getElementById('density-toggle');

  const themeToggle = document.getElementById('theme-toggle');

  const WORDS_PER_MINUTE = 200;
  let densityExpanded = false;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cc-theme', theme);
  }

  const savedTheme = localStorage.getItem('cc-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function countSentences(text) {
    const matches = text.match(/[^.!?]*[.!?]+|[^.!?]+$/g);
    if (!matches) return 0;
    return matches.filter(s => s.trim().length > 0).length;
  }

  function getLetterDensity(text) {
    const letters = text.toLowerCase().match(/[a-z]/g);
    if (!letters) return { counts: [], total: 0 };

    const map = new Map();
    for (const letter of letters) {
      map.set(letter, (map.get(letter) || 0) + 1);
    }

    const counts = Array.from(map.entries())
      .map(([letter, count]) => ({ letter, count }))
      .sort((a, b) => b.count - a.count || a.letter.localeCompare(b.letter));

    return { counts, total: letters.length };
  }

  function render() {
    const raw = textInput.value;
    const charLength = excludeSpaces.checked
      ? raw.replace(/ /g, '').length
      : raw.length;

    charCountEl.textContent = charLength;
    wordCountEl.textContent = countWords(raw);
    sentenceCountEl.textContent = countSentences(raw);

    const words = countWords(raw);
    const minutes = words / WORDS_PER_MINUTE;
    if (minutes < 1) {
      readingTimeEl.textContent = '<1';
      readingTimePlural.textContent = '';
    } else {
      const rounded = Math.round(minutes);
      readingTimeEl.textContent = rounded;
      readingTimePlural.textContent = rounded === 1 ? '' : 's';
    }

    if (limitToggle.checked) {
      const limit = Math.max(0, parseInt(limitInput.value, 10) || 0);
      const over = Math.max(0, charLength - limit);
      const isOverLimit = over > 0;

      limitWarning.hidden = !isOverLimit;
      limitExceededCount.textContent = over;
      textInput.classList.toggle('is-over-limit', isOverLimit);
    } else {
      limitWarning.hidden = true;
      limitExceededCount.textContent = '0';
      textInput.classList.remove('is-over-limit');
    }

    renderDensity(raw);
  }

  function renderDensity(raw) {
    const { counts, total } = getLetterDensity(raw);

    if (total === 0) {
      densityEmpty.hidden = false;
      densityList.hidden = true;
      densityToggle.hidden = true;
      densityList.innerHTML = '';
      return;
    }

    densityEmpty.hidden = true;
    densityList.hidden = false;

    const visibleCounts = densityExpanded ? counts : counts.slice(0, 5);
    densityToggle.hidden = counts.length <= 5;

    densityList.innerHTML = visibleCounts.map(({ letter, count }) => {
      const pct = ((count / total) * 100).toFixed(2);
      return `
        <li class="density__row">
          <span class="density__letter">${letter}</span>
          <span class="density__track">
            <span class="density__fill" style="width:${pct}%"></span>
          </span>
          <span class="density__meta">${count} (${pct}%)</span>
        </li>
      `;
    }).join('');

    densityToggle.classList.toggle('is-expanded', densityExpanded);
    densityToggle.innerHTML = densityExpanded
      ? `See less <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      : `See more <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true"><path d="M1 1.5 6 6.5l5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }


  textInput.addEventListener('input', render);
  excludeSpaces.addEventListener('change', render);
  limitInput.addEventListener('input', render);

  limitToggle.addEventListener('change', () => {
    limitInputWrap.hidden = !limitToggle.checked;
    render();
  });

  densityToggle.addEventListener('click', () => {
    densityExpanded = !densityExpanded;
    renderDensity(textInput.value);
  });

  render();
})();