// signup.js
// Creates a demo account: validates the form, hashes the password, writes
// a user record via storage.js, then logs the new account straight in.

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

function validate() {
  let valid = true;

  if (!auth.isValidEmail(emailInput.value.trim())) {
    auth.setFieldError(emailInput, emailError, 'Enter a valid email address.');
    valid = false;
  } else {
    auth.setFieldError(emailInput, emailError, '');
  }

  if (passwordInput.value.length < 8) {
    auth.setFieldError(passwordInput, passwordError, 'Password must be at least 8 characters.');
    valid = false;
  } else {
    auth.setFieldError(passwordInput, passwordError, '');
  }

  return valid;
}

emailInput.addEventListener('blur', validate);
passwordInput.addEventListener('blur', validate);

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validate()) {
    (emailInput.classList.contains('is-invalid') ? emailInput : passwordInput).focus();
    return;
  }

  const email = emailInput.value.trim();
  if (storage.findUserByEmail(email)) {
    auth.setFieldError(emailInput, emailError, 'An account with this email already exists.');
    emailInput.focus();
    return;
  }

  const passwordHash = await auth.hashPassword(passwordInput.value);
  storage.addUser({ email, passwordHash });
  storage.saveSession(email);

  auth.showFeedback(feedbackEl, 'Account created! Redirecting…');
  setTimeout(() => { window.location.href = 'index.html'; }, 600);
});

auth.wireGoogleButton(googleBtn, feedbackEl);
