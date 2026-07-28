// auth.js
// Shared helpers for the sign up / login / forgot-password / reset-password
// pages: password hashing, token generation, and the small DOM utilities
// every auth form needs (show/hide password, inline field errors, a toast).
// Never touches storage directly — that stays storage.js's job.

import * as storage from './storage.js';

const toHex = (bytes) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 hex digest, so a password never gets written to localStorage in plain text. */
export const hashPassword = async (password) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return toHex(new Uint8Array(digest));
};

/** Random token for reset-password links (stands in for what a real backend would email). */
export const generateToken = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

export const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Wires an eye-icon button to toggle an adjacent input between password/text. */
export const initPasswordToggle = (toggleBtn, input) => {
  if (!toggleBtn || !input) return;
  toggleBtn.addEventListener('click', () => {
    const isRevealing = input.type === 'password';
    input.type = isRevealing ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(isRevealing));
    toggleBtn.setAttribute('aria-label', isRevealing ? 'Hide password' : 'Show password');
    toggleBtn.querySelector('use').setAttribute('href', isRevealing ? '#icon-eye-off' : '#icon-eye');
  });
};

/** Show (or clear) a validation error under a form field. */
export const setFieldError = (input, errorEl, message) => {
  input.classList.toggle('is-invalid', Boolean(message));
  input.setAttribute('aria-invalid', String(Boolean(message)));
  if (errorEl) errorEl.textContent = message || '';
};

let toastTimeout = null;
export const showFeedback = (feedbackEl, message, { type = 'info', duration = 3200 } = {}) => {
  feedbackEl.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `toast${type === 'error' ? ' toast-error' : ''}`;
  toast.textContent = message;
  feedbackEl.appendChild(toast);

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    feedbackEl.innerHTML = '';
  }, duration);
};

/** signup.html/login.html only make sense signed out — bounce an existing session straight in. */
export const redirectIfAuthenticated = () => {
  if (storage.loadSession()) window.location.replace('index.html');
};

/** Every auth page's "Google" button does the same not-really-implemented thing. */
export const wireGoogleButton = (btn, feedbackEl) => {
  btn.addEventListener('click', () => {
    showFeedback(feedbackEl, "Google sign-in isn't available in this demo.", { type: 'error' });
  });
};
