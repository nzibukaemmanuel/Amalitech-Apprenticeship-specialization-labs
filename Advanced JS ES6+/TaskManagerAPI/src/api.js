import { APIError } from './errors.js';
import { createCache, withCache } from './cache.js';
import { runWithConcurrencyLimit } from './rateLimiter.js';

const DEFAULT_BASE_URL = 'https://jsonplaceholder.typicode.com';

export class APIClient {
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
    this.cache = createCache();

    // Memoized public methods — same resource never fetched twice.
    this.fetchUsers = withCache(this.cache, () => 'users', this.#fetchUsersRaw.bind(this));
    this.fetchTodos = withCache(this.cache, () => 'todos', this.#fetchTodosRaw.bind(this));
    this.fetchUserTodos = withCache(
      this.cache,
      (userId) => `userTodos:${userId}`,
      this.#fetchUserTodosRaw.bind(this)
    );
  }

  async #request(path) {
    const url = `${this.baseUrl}${path}`;
    let response;

    try {
      response = await fetch(url);
    } catch (networkError) {
      throw new APIError(`Network request failed for ${url}`, { url, cause: networkError });
    }

    if (!response.ok) {
      throw new APIError(`Request to ${url} failed with status ${response.status}`, {
        status: response.status,
        url
      });
    }

    try {
      return await response.json();
    } catch (parseError) {
      throw new APIError(`Failed to parse JSON from ${url}`, { url, cause: parseError });
    }
  }

  async #fetchUsersRaw() {
    const data = await this.#request('/users');
    return Array.isArray(data) ? data : [];
  }

  async #fetchTodosRaw() {
    const data = await this.#request('/todos');
    return Array.isArray(data) ? data : [];
  }

  async #fetchUserTodosRaw(userId) {
    const data = await this.#request(`/users/${userId}/todos`);
    return Array.isArray(data) ? data : [];
  }

  // Concurrent fetch — demonstrates Promise.all() as required by the spec.
  async fetchAll() {
    const [users, todos] = await Promise.all([this.fetchUsers(), this.fetchTodos()]);
    return { users, todos };
  }

  // Bonus: rate-limited concurrent requests. Fetching one /users/:id/todos
  // request per user with a plain Promise.all() would fire them all at once;
  // this caps how many are ever in flight simultaneously.
  async fetchTodosForUsers(userIds, { concurrency = 3 } = {}) {
    const results = await runWithConcurrencyLimit(
      userIds,
      (userId) => this.fetchUserTodos(userId),
      concurrency
    );
    return userIds.reduce((map, userId, index) => {
      map.set(userId, results[index]);
      return map;
    }, new Map());
  }

  // Plain Promise-chain version (no async/await), since the brief asks for both styles.
  fetchUsersPromiseStyle() {
    const url = `${this.baseUrl}/users`;
    return fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new APIError(`Request failed with status ${response.status}`, { status: response.status, url });
        }
        return response.json();
      })
      .catch((error) => {
        if (error instanceof APIError) throw error;
        throw new APIError('Network request failed', { url, cause: error });
      });
  }
}
