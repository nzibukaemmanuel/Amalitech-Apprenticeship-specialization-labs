// Closure-based cache: `store` is only reachable through the methods this
// function returns — nothing outside can touch it directly. This is the
// classic "module pattern" use of closures for real encapsulation, which is
// stronger than just using a plain object (anyone could mutate that).
export function createCache() {
  const store = new Map();
  let hitCount = 0;
  let missCount = 0;

  return {
    has(key) {
      return store.has(key);
    },
    get(key) {
      if (store.has(key)) {
        hitCount += 1;
        return store.get(key);
      }
      missCount += 1;
      return undefined;
    },
    set(key, value) {
      store.set(key, value);
      return value;
    },
    clear() {
      store.clear();
    },
    get size() {
      return store.size;
    },
    get stats() {
      return { hits: hitCount, misses: missCount, size: store.size };
    }
  };
}

// Higher-order function: wraps any async function so repeated calls with the
// same derived key are served from cache instead of hitting the network again.
// Note: since `undefined` is used as the "not cached" sentinel, a wrapped
// function that legitimately resolves to `undefined` will never be treated
// as a cache hit. Fine here (API responses are always arrays/objects), but
// worth knowing if this cache is reused for other purposes.
export function withCache(cache, keyFn, fn) {
  return async (...args) => {
    const key = keyFn(...args);
    const cached = cache.get(key); // this call itself records the hit/miss
    if (cached !== undefined) return cached;
    const result = await fn(...args);
    cache.set(key, result);
    return result;
  };
}
