// themes.js
// Applies theme/font choices to the document root and persists them.
// Kept deliberately tiny: one job, two functions.

import * as storage from './storage.js';

const root = document.documentElement;
const VALID_THEMES = ['light', 'dark'];
const VALID_FONTS = ['sans', 'serif', 'mono'];

export const applyTheme = (themeName, { persist = true } = {}) => {
  const theme = VALID_THEMES.includes(themeName) ? themeName : 'light';
  root.setAttribute('data-theme', theme);

  const select = document.getElementById('theme-select');
  if (select) select.value = theme;

  if (persist) {
    const prefs = storage.loadPreferences();
    storage.savePreferences({ ...prefs, theme });
  }
  return theme;
};

export const applyFont = (fontName, { persist = true } = {}) => {
  const font = VALID_FONTS.includes(fontName) ? fontName : 'sans';
  root.setAttribute('data-font', font);

  const select = document.getElementById('font-select');
  if (select) select.value = font;

  if (persist) {
    const prefs = storage.loadPreferences();
    storage.savePreferences({ ...prefs, font });
  }
  return font;
};

/** Apply whatever was saved (or defaults) — call once on startup. */
export const applySavedPreferences = () => {
  const prefs = storage.loadPreferences();
  applyTheme(prefs.theme, { persist: false });
  applyFont(prefs.font, { persist: false });
  return prefs;
};
