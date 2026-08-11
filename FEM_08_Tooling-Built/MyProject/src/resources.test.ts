import { describe, expect, it } from 'vitest';
import { resources } from './resources';

describe('resources', () => {
  it('is a non-empty array', () => {
    expect(resources.length).toBeGreaterThan(0);
  });

  it('has unique names', () => {
    const names = resources.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(resources)('$name has valid fields', (resource) => {
    expect(resource.name).not.toBe('');
    expect(resource.category).not.toBe('');
    expect(resource.description).not.toBe('');
    expect(resource.link).toMatch(/^https:\/\//);
  });
});
