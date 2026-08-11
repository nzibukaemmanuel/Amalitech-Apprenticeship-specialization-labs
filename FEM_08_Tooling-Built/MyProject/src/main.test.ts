import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resources } from './resources';

beforeEach(async () => {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import('./main.ts');
});

describe('main', () => {
  it('renders a card for every resource by default', () => {
    const cards = document.querySelectorAll('.card');
    expect(cards.length).toBe(resources.length);
  });

  it('renders an "All" chip plus one chip per category', () => {
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('.chip'));
    const categories = new Set(resources.map((r) => r.category));
    expect(chips[0].textContent).toBe('All');
    expect(chips.length).toBe(categories.size + 1);
  });

  it('filters results as the search query changes', () => {
    const input = document.querySelector<HTMLInputElement>('#search')!;
    input.value = 'typescript';
    input.dispatchEvent(new Event('input'));

    const cards = document.querySelectorAll('.card');
    expect(cards.length).toBe(1);
    expect(cards[0].textContent).toContain('TypeScript Handbook');
  });

  it('filters results when a category chip is clicked', () => {
    const toolsChip = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.chip')
    ).find((chip) => chip.dataset.category === 'Tools')!;
    toolsChip.click();

    const badges = Array.from(document.querySelectorAll('.badge'));
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((badge) => badge.textContent === 'Tools')).toBe(true);
    expect(toolsChip.classList.contains('active')).toBe(true);
  });

  it('shows an empty state when no resources match the search', () => {
    const input = document.querySelector<HTMLInputElement>('#search')!;
    input.value = 'not-a-real-resource-xyz';
    input.dispatchEvent(new Event('input'));

    expect(document.querySelector('.empty')).not.toBeNull();
    expect(document.querySelectorAll('.card').length).toBe(0);
  });
});
