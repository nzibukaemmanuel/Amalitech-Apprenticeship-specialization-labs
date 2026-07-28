// forgot-password.js
// There's no email server behind this demo, so instead of pretending to
// send mail, a reset token is generated and stored (storage.js), and the
// link that would normally arrive by email is surfaced directly on-page.

import * as storage from './storage.js';
import * as themes from './themes.js';
import * as auth from './auth.js';
import { mountBrand } from './brand.js';

themes.applySavedPreferences();
mountBrand();

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('email-error');
const feedbackEl = document.getElementById('feedback');
const demoNotice = document.getElementById('demo-reset-notice');
const demoLink = document.getElementById('demo-reset-link');

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  if (!auth.isValidEmail(email)) {
    auth.setFieldError(emailInput, emailError, 'Enter a valid email address.');
    emailInput.focus();
    return;
  }
  auth.setFieldError(emailInput, emailError, '');

  const token = auth.generateToken();
  storage.saveResetRequest(email, token);

  form.hidden = true;
  // Deliberately doesn't reveal whether the email actually has an account —
  // reset-password.js is what actually rejects unknown emails.
  auth.showFeedback(feedbackEl, `If an account exists for ${email}, reset instructions have been sent.`);

  demoLink.href = `reset-password.html?email=${encodeURIComponent(email)}&token=${token}`;
  demoNotice.hidden = false;
});
