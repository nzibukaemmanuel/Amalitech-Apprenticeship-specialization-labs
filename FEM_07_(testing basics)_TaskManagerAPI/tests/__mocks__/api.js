/**
 * tests/__mocks__/api.js
 * -----------------------
 * Plain-language summary:
 * This file is a "stunt double" for the real APIClient. Real APIs are
 * slow, can go offline, and — in this project — are also memoized
 * (cached), which makes their behavior depend on call history. For
 * most tests we want fixed, instant, predictable data every time, so
 * this file provides:
 *
 *   1. Fixed sample data (mockUsers, mockTodos) shaped exactly like
 *      real JSONPlaceholder API responses.
 *   2. A MockAPIClient class with the exact same method names as the
 *      real APIClient (fetchUsers, fetchTodos, fetchUserTodos,
 *      fetchAll), so it can be swapped in anywhere the real one is
 *      used - most usefully inside TaskManager for workflow tests.
 */

export const mockUsers = [
  { id: 1, name: 'Leanne Graham', email: 'leanne@example.com' },
  { id: 2, name: 'Ervin Howell', email: 'ervin@example.com' },
  { id: 3, name: 'Clementine Bauch', email: 'clementine@example.com' },
];

export const mockTodos = [
  { id: 1, userId: 1, title: 'Buy groceries', completed: false },
  { id: 2, userId: 1, title: 'Finish report', completed: true },
  { id: 3, userId: 2, title: 'Book flights', completed: false },
  { id: 4, userId: 2, title: 'Walk the dog', completed: true },
  { id: 5, userId: 3, title: 'Clean garage', completed: false },
];

/**
 * Plain language: a fake stand-in for APIClient. Every method resolves
 * instantly with sample data instead of making a real network call, so
 * tests using this class never touch the internet and never flake.
 */
export class MockAPIClient {
  constructor() {
    this.baseUrl = 'https://mock-api.test';
  }

  async fetchUsers() {
    return [...mockUsers];
  }

  async fetchTodos() {
    return [...mockTodos];
  }

  async fetchUserTodos(userId) {
    return mockTodos.filter((todo) => todo.userId === userId);
  }

  async fetchAll() {
    const [users, todos] = await Promise.all([this.fetchUsers(), this.fetchTodos()]);
    return { users, todos };
  }

  async fetchTodosForUsers(userIds) {
    return userIds.reduce(async (mapPromise, userId) => {
      const map = await mapPromise;
      map.set(userId, await this.fetchUserTodos(userId));
      return map;
    }, Promise.resolve(new Map()));
  }
}
