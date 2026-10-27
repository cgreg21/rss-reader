import { describe, expect, it } from 'vitest';

import { Category, Feed } from './models';
import { buildOpml, parseOpml } from './opml';

const categories: Category[] = [{ id: 'c1', name: 'Tech & Co' }];
const feeds: Feed[] = [
  { id: 'a', url: 'https://a.com/rss', title: 'A "quoted"', categoryId: 'c1' },
  { id: 'b', url: 'https://b.com/rss', title: 'B', categoryId: null },
];

describe('opml', () => {
  it('round-trips feeds and categories', () => {
    const entries = parseOpml(buildOpml(categories, feeds));
    expect(entries).toEqual([
      { url: 'https://a.com/rss', title: 'A "quoted"', category: 'Tech & Co' },
      { url: 'https://b.com/rss', title: 'B', category: null },
    ]);
  });

  it('rejects invalid files', () => {
    expect(() => parseOpml('<html></html>')).toThrow();
    expect(() => parseOpml('pas du xml')).toThrow();
  });
});
