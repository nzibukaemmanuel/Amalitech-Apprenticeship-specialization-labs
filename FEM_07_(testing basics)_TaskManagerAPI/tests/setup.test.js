/**
 * setup.test.js
 * Plain language: a tiny sanity check confirming Jest is installed AND
 * that it can correctly load our project's modern `import`/`export`
 * (ES module) source files via the Babel transform, before we trust
 * any of the real test files.
 */
import { Task } from '../src/models.js';

describe('Jest + Babel setup verification', () => {
  it('runs a basic assertion correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('can import a real ES module source file (src/models.js)', () => {
    const task = new Task({ id: 1, title: 'Setup check' });
    expect(task.getStatus()).toBe('Pending');
  });
});
