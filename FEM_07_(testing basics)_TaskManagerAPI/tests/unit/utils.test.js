/**
 * utils.test.js
 * --------------
 * Plain-language summary:
 * This project's "utility" layer is the closure-based cache
 * (src/cache.js), the concurrency-limiting rate limiter
 * (src/rateLimiter.js), and the custom error types (src/errors.js).
 *
 * Part 1 tests the cache and rate limiter for plain correctness.
 * Part 2 uses Jest "spies" - a spy is like a hidden camera attached
 * to a real function: the function still works normally, but
 * afterwards you can ask "how many times was this called, and with
 * what arguments?". We use spies here to prove the cache actually
 * prevents repeat work, to watch Array method usage inside
 * taskProcessor, and to check console output without ever letting it
 * print to the real terminal during a test run.
 */

import { createCache, withCache } from '../../src/cache.js';
import { runWithConcurrencyLimit } from '../../src/rateLimiter.js';
import { APIError, ValidationError } from '../../src/errors.js';
import { calculateStatistics, sortTasks, byTitleAsc } from '../../src/taskProcessor.js';
import { PriorityTask } from '../../src/models.js';

describe('createCache() / withCache()', () => {
  it('starts empty with zero hits and misses', () => {
    const cache = createCache();
    expect(cache.size).toBe(0);
    expect(cache.stats).toEqual({ hits: 0, misses: 0, size: 0 });
  });

  it('set() then get() returns the stored value', () => {
    const cache = createCache();
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('has() correctly reports presence/absence of a key', () => {
    const cache = createCache();
    cache.set('present', true);
    expect(cache.has('present')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('records a miss when reading a key that was never set', () => {
    const cache = createCache();
    cache.get('nope');
    expect(cache.stats.misses).toBe(1);
    expect(cache.stats.hits).toBe(0);
  });

  it('records a hit when reading a key that was set', () => {
    const cache = createCache();
    cache.set('k', 1);
    cache.get('k');
    expect(cache.stats.hits).toBe(1);
  });

  it('clear() empties the cache completely', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.has('a')).toBe(false);
  });

  it('withCache() only calls the underlying function once per unique key', async () => {
    const cache = createCache();
    const expensiveFn = jest.fn(async (x) => x * 2);
    const cachedFn = withCache(cache, (x) => `key:${x}`, expensiveFn);

    const r1 = await cachedFn(5);
    const r2 = await cachedFn(5); // same key -> should hit cache, not call again

    expect(r1).toBe(10);
    expect(r2).toBe(10);
    expect(expensiveFn).toHaveBeenCalledTimes(1);
  });

  it('withCache() calls the underlying function separately for different keys', async () => {
    const cache = createCache();
    const fn = jest.fn(async (x) => x + 1);
    const cachedFn = withCache(cache, (x) => `key:${x}`, fn);

    await cachedFn(1);
    await cachedFn(2);

    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('runWithConcurrencyLimit()', () => {
  it('preserves the input order of results even though work finishes out of order', async () => {
    const items = [1, 2, 3, 4, 5];
    const worker = async (n) => {
      // Larger numbers "finish" faster to deliberately scramble completion order.
      await new Promise((resolve) => setTimeout(resolve, (6 - n) * 2));
      return n * 10;
    };

    const results = await runWithConcurrencyLimit(items, worker, 2);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it('never runs more workers concurrently than the given limit', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5, 6];

    const worker = async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return n;
    };

    await runWithConcurrencyLimit(items, worker, 2);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('defaults to a concurrency limit of 3 when none is given', async () => {
    let active = 0;
    let maxActive = 0;
    const items = [1, 2, 3, 4, 5, 6, 7, 8];

    const worker = async (n) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 3));
      active -= 1;
      return n;
    };

    await runWithConcurrencyLimit(items, worker);
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns an empty array for an empty items list', async () => {
    const results = await runWithConcurrencyLimit([], async (n) => n, 2);
    expect(results).toEqual([]);
  });

  it('handles a limit larger than the item count without error', async () => {
    const results = await runWithConcurrencyLimit([1, 2], async (n) => n * 100, 10);
    expect(results).toEqual([100, 200]);
  });
});

describe('Custom error types (errors.js)', () => {
  it('APIError carries status, url, and cause information', () => {
    const cause = new Error('boom');
    const err = new APIError('Something failed', { status: 500, url: '/todos', cause });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('APIError');
    expect(err.status).toBe(500);
    expect(err.url).toBe('/todos');
    expect(err.cause).toBe(cause);
  });

  it('APIError omits "cause" when none is given', () => {
    const err = new APIError('No cause here');
    expect(err.cause).toBeUndefined();
  });

  it('ValidationError carries a field name', () => {
    const err = new ValidationError('Title is required', 'title');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ValidationError');
    expect(err.field).toBe('title');
  });
});

describe('Spy-based tests', () => {
  describe('spying to prove the cache prevents duplicate work', () => {
    it('verifies the wrapped function is invoked exactly once across repeated calls', async () => {
      const cache = createCache();
      const spyFn = jest.fn(async () => 'result');
      const cachedFn = withCache(cache, () => 'fixed-key', spyFn);

      await cachedFn();
      await cachedFn();
      await cachedFn();

      expect(spyFn).toHaveBeenCalledTimes(1);
    });

    it('spies on cache.get to confirm it is consulted on every call, hit or miss', async () => {
      const cache = createCache();
      const getSpy = jest.spyOn(cache, 'get');
      const cachedFn = withCache(cache, () => 'k', async () => 'v');

      await cachedFn();
      await cachedFn();

      expect(getSpy).toHaveBeenCalledTimes(2);
      getSpy.mockRestore();
    });
  });

  describe('spying on internal method calls within classes', () => {
    it('verifies toggle() is actually invoked when we call it', () => {
      const task = new PriorityTask({ id: 1, title: 'Spy target' });
      const toggleSpy = jest.spyOn(task, 'toggle');
      task.toggle();
      expect(toggleSpy).toHaveBeenCalledTimes(1);
      toggleSpy.mockRestore();
    });

    it('verifies isOverdue() is called internally by getStatus()', () => {
      const task = new PriorityTask({ id: 2, title: 'Overdue check', dueDate: '2020-01-01' });
      const isOverdueSpy = jest.spyOn(task, 'isOverdue');
      task.getStatus();
      expect(isOverdueSpy).toHaveBeenCalled();
      isOverdueSpy.mockRestore();
    });
  });

  describe('spying on calls to built-in Array methods', () => {
    it('confirms calculateStatistics() internally calls Array.prototype.filter', () => {
      const filterSpy = jest.spyOn(Array.prototype, 'filter');
      calculateStatistics([
        new PriorityTask({ id: 1, title: 'A', completed: true }),
        new PriorityTask({ id: 2, title: 'B', completed: false }),
      ]);
      expect(filterSpy).toHaveBeenCalled();
      filterSpy.mockRestore();
    });

    it('confirms sortTasks() internally calls Array.prototype.sort', () => {
      const sortSpy = jest.spyOn(Array.prototype, 'sort');
      sortTasks(
        [new PriorityTask({ id: 1, title: 'B' }), new PriorityTask({ id: 2, title: 'A' })],
        byTitleAsc
      );
      expect(sortSpy).toHaveBeenCalledTimes(1);
      sortSpy.mockRestore();
    });

    it('verifies the arguments passed into a mapped callback', () => {
      const cb = jest.fn((n) => n * 2);
      [1, 2, 3].map(cb);
      expect(cb).toHaveBeenCalledTimes(3);
      expect(cb).toHaveBeenNthCalledWith(1, 1, 0, expect.any(Array));
    });
  });

  describe('spying on console methods', () => {
    let logSpy;
    let warnSpy;
    let errorSpy;

    beforeEach(() => {
      // Silence real console output during the test and capture calls instead.
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      // Always restore afterwards so other tests get the real console back.
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('captures a console.log call and its message', () => {
      console.log('Task created successfully');
      expect(logSpy).toHaveBeenCalledWith('Task created successfully');
    });

    it('captures a console.warn call for a risky operation', () => {
      console.warn('Task is nearing its due date');
      expect(warnSpy.mock.calls[0][0]).toContain('due date');
    });

    it('captures a console.error call matching what main.js logs on a failed load()', () => {
      const error = new APIError('Request failed with status 500', { status: 500 });
      console.error('Failed to load data:', error.message);
      expect(errorSpy).toHaveBeenCalledWith('Failed to load data:', 'Request failed with status 500');
    });
  });
});
