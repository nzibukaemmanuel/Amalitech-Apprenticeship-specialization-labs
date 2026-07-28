// reset-password.js
// Reads the (email, token) pair the "emailed" link carries in its query
// string, checks it against the pending reset request in storage.js, and
// only then lets the user set a new password.

import * as storage from './storage.js';
import * as themes from './themes.js';
import * as auth from './auth.js';
import { mountBrand } from './brand.js';

themes.applySavedPreferences();
mountBrand();

const params = new URLSearchParams(window.location.search);
const email = params.get('email') || '';
const token = params.get('token') || '';

const formView = document.getElementById('reset-form-view');
const invalidNotice = document.getElementById('invalid-link-notice');
const form = document.getElementById('auth-form');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('password-error');
const passwordToggle = document.getElementById('password-toggle');
const confirmInput = document.getElementById('confirm-password');
const confirmError = document.getElementById('confirm-password-error');
const confirmToggle = document.getElementById('confirm-password-toggle');
const feedbackEl = document.getElementById('feedback');

const request = storage.loadResetRequest();
const linkIsValid = Boolean(
  request &&
  email &&
  request.email.toLowerCase() === email.toLowerCase() &&
  request.token === token &&
  request.expiresAt > Date.now() &&
  storage.findUserByEmail(email)
);

if (!linkIsValid) {
  formView.hidden = true;
  invalidNotice.hidden = false;
} else {
  auth.initPasswordToggle(passwordToggle, passwordInput);
  auth.initPasswordToggle(confirmToggle, confirmInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let valid = true;
    if (passwordInput.value.length < 8) {
      auth.setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
      valid = false;
    } else {
      auth.setFieldError(passwordInput, passwordError, '');
    }
    if (confirmInput.value !== passwordInput.value) {
      auth.setFieldError(confirmInput, confirmError, "Passwords don't match.");
      valid = false;
    } else {
      auth.setFieldError(confirmInput, confirmError, '');
    }
    if (!valid) {
      (passwordInput.classList.contains('is-invalid') ? passwordInput : confirmInput).focus();
      return;
    }

    const passwordHash = await auth.hashPassword(passwordInput.value);
    storage.updateUserPassword(email, passwordHash);
    storage.clearResetRequest();

    form.hidden = true;

    // "Change Password" (main.js) reaches this page while already logged
    // in — sending that visitor to login.html would just bounce them
    // straight back to index.html (login.js redirects authenticated
    // visitors away), leaving a stale "redirecting to login" message.
    const alreadySignedIn = storage.loadSession();
    const destination = alreadySignedIn ? 'index.html' : 'login.html';
    auth.showFeedback(feedbackEl, alreadySignedIn ? 'Password updated!' : 'Password updated! Redirecting to login…');
    setTimeout(() => { window.location.href = destination; }, 900);
  });
}
