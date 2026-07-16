document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('text-input');
  const excludeSpacesBox = document.getElementById('exclude-spaces');
  const enableLimitBox = document.getElementById('enable-char-limit');
  const limitInput = document.getElementById('char-limit-input');

  const totalCharsEl = document.getElementById('total-characters');
  const wordCountEl = document.getElementById('word-count');
  const lineCountEl = document.getElementById('line-count');
  const readingTimeEl = document.getElementById('reading-time');
  const charsCard = document.getElementById('chars-card');
  const densityList = document.getElementById('density-list');

  const themeToggle = document.getElementById('theme-toggle');
  const toggleDensityBtn = document.getElementById('toggle-density');

  const AVG_READING_WPM = 200;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');

  const countCharacters = (text) => {
    if (excludeSpacesBox.checked) {
      return text.replace(/\s/g, '').length;
    }
    return text.length;
  };

  const countWords = (text) => {
    const trimmed = text.trim();
    if (trimmed === '') {
      return 0;
    }
    return trimmed.split(/\s+/).length;
  };

  const countLines = (text) => (text === '' ? 0 : text.split(/\n/).length);

  const calcReadingTime = (wordCount) => {
    const minutes = wordCount / AVG_READING_WPM;
    if (minutes < 1) {
      return '<1 minute';
    }
    const rounded = Math.round(minutes);
    return `${rounded} minute${rounded === 1 ? '' : 's'}`;
  };

  const calcLetterDensity = (text) => {
    const counts = {};
    let totalLetters = 0;
    const loweredText = text.toLowerCase();

    for (let i = 0; i < loweredText.length; i += 1) {
      const rawChar = loweredText.charAt(i);
      if (/[a-z]/.test(rawChar)) {
        counts[rawChar] = (counts[rawChar] || 0) + 1;
        totalLetters += 1;
      }
    }

    const countValues = Object.keys(counts).map((key) => counts[key]);
    const maxCount = countValues.reduce((highest, count) => Math.max(highest, count), 0);

    return alphabet.map((letter) => {
      const count = counts[letter] || 0;
      return {
        letter,
        count,
        percent: totalLetters ? (count / totalLetters) * 100 : 0,
        barPercent: maxCount ? (count / maxCount) * 100 : 0,
      };
    });
  };

  const render = () => {
    let text = textInput.value;

    if (enableLimitBox.checked) {
      const limit = parseInt(limitInput.value, 10);
      if (!Number.isNaN(limit) && limit > 0 && text.length > limit) {
        text = text.slice(0, limit);
        textInput.value = text;
      }
    }

    const totalChars = countCharacters(text);
    const words = countWords(text);
    const lines = countLines(text);
    let lineText = String(lines);

    if (lineText.length < 2) {
      lineText = `0${lineText}`;
    }

    totalCharsEl.textContent = totalChars;
    wordCountEl.textContent = words;
    lineCountEl.textContent = lineText;
    readingTimeEl.textContent = calcReadingTime(words);

    if (enableLimitBox.checked) {
      const activeLimit = parseInt(limitInput.value, 10);
      const overLimit = !Number.isNaN(activeLimit) && activeLimit > 0 && text.length >= activeLimit;
      charsCard.classList.toggle('over-limit', overLimit);
    } else {
      charsCard.classList.remove('over-limit');
    }

    const density = calcLetterDensity(text);
    const letterCount = text.replace(/[^a-z]/gi, '').length;
    const shouldExpand = densityList.classList.contains('expanded');
    const visibleRows = shouldExpand ? density : density.slice(0, 6);

    if (toggleDensityBtn) {
      const buttonText = letterCount > 6 ? 'Show more' : 'Show less';
      toggleDensityBtn.textContent = buttonText;
      toggleDensityBtn.disabled = letterCount <= 6;
      if (letterCount <= 6) {
        densityList.classList.remove('expanded');
        toggleDensityBtn.setAttribute('aria-expanded', 'false');
      }
    }

    densityList.innerHTML = visibleRows.map((item) => `
      <div class="density-row">
        <span class="letter">${item.letter}</span>
        <div class="progress-container">
          <div class="progress-bar" style="width: ${item.barPercent.toFixed(2)}%"></div>
        </div>
        <span class="stats">${item.count} (${item.percent.toFixed(2)}%)</span>
      </div>
    `).join('');
  };

  textInput.addEventListener('input', render);
  excludeSpacesBox.addEventListener('change', render);

  document.querySelectorAll('.checkbox-label').forEach((label) => {
    label.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const checkbox = label.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  });

  if (toggleDensityBtn) {
    toggleDensityBtn.addEventListener('click', () => {
      const expanded = densityList.classList.toggle('expanded');
      toggleDensityBtn.textContent = expanded ? 'Show less' : 'Show more';
      toggleDensityBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      render();
    });
  }

  enableLimitBox.addEventListener('change', () => {
    const isChecked = enableLimitBox.checked;
    limitInput.style.display = isChecked ? 'inline-block' : 'none';
    enableLimitBox.setAttribute('aria-expanded', isChecked ? 'true' : 'false');
    if (isChecked) {
      limitInput.focus();
    }
    render();
  });

  limitInput.addEventListener('input', render);

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLightTheme = document.body.classList.contains('light-theme');
    themeToggle.setAttribute('aria-pressed', isLightTheme ? 'true' : 'false');
    themeToggle.setAttribute('aria-label', isLightTheme ? 'Switch to dark theme' : 'Switch to light theme');
  });

  themeToggle.setAttribute('aria-pressed', 'false');
  themeToggle.setAttribute('aria-label', 'Switch to light theme');

  render();
});