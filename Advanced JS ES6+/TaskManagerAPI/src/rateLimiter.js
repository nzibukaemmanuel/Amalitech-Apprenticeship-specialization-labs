// Promise-based concurrency limiter — no external dependencies, no timers.
// Fires up to `limit` workers at once; each worker picks up the next item
// as soon as it finishes, so the pool stays saturated without ever running
// more than `limit` requests concurrently. This is what "rate limiting" means
// here: bounding how many in-flight API calls exist at once, not a fixed
// requests-per-second throttle.
export async function runWithConcurrencyLimit(items, worker, limit = 3) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const currentIndex = nextIndex++;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  }

  const poolSize = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: poolSize }, runNext));

  return results;
}
