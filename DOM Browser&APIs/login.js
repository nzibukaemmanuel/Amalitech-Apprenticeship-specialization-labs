// login.js
// Validates the form, hashes the entered password, and compares it against
// the stored hash for that email before starting a session.

import * as storage from './storage.js';
import * as themes from './themes.js';
import * as auth from './auth.js';
import { mountBrand } from './brand.js';

themes.applySavedPreferences();
auth.redirectIfAuthenticated();
mountBrand();

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('email-error');
const passwordInput = document.getElementById('password');
const passwordError = document.getElementById('password-error');
const passwordToggle = document.getElementById('password-toggle');
const feedbackEl = document.getElementById('feedback');
const googleBtn = document.getElementById('google-btn');

auth.initPasswordToggle(passwordToggle, passwordInput);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  let valid = true;
  if (!auth.isValidEmail(email)) {
    auth.setFieldError(emailInput, emailError, 'Enter a valid email address.');
    valid = false;
  } else {
    auth.setFieldError(emailInput, emailError, '');
  }
  if (!password) {
    auth.setFieldError(passwordInput, passwordError, 'Enter your password.');
    valid = false;
  } else {
    auth.setFieldError(passwordInput, passwordError, '');
  }
  if (!valid) {
    (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
    return;
  }

  const user = storage.findUserByEmail(email);
  const passwordHash = await auth.hashPassword(password);

  if (!user || user.passwordHash !== passwordHash) {
    auth.showFeedback(feedbackEl, 'Incorrect email or password.', { type: 'error' });
    passwordInput.focus();
    return;
  }

  storage.saveSession(email);
  auth.showFeedback(feedbackEl, 'Welcome back! Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 500);
});

auth.wireGoogleButton(googleBtn, feedbackEl);
