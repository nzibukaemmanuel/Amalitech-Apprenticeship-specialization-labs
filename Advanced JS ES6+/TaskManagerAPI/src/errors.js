// Custom error types give callers something more specific than a generic Error
// to check against, and let us attach context (status code, URL, root cause).

export class APIError extends Error {
  constructor(message, { status, url, cause } = {}) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.url = url;
    if (cause) this.cause = cause;
  }
}

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}
