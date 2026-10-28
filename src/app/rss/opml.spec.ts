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

  it('handles unknown categories, untitled outlines and nested labels', () => {
    const xml = `<opml><body><outline text="A"><outline xmlUrl="https://x.com/r"/><outline><outline xmlUrl="https://y.com/r" text="Y"/></outline></outline></body></opml>`;
    expect(parseOpml(xml)).toEqual([
      { url: 'https://x.com/r', title: 'https://x.com/r', category: 'A' },
      { url: 'https://y.com/r', title: 'Y', category: 'A' },
    ]);
    const orphan = buildOpml([{ id: 'c', name: 'Empty' }], [{ id: 'z', url: 'https://z.com', title: 'Z', siteUrl: 'https://z.com/', categoryId: 'missing' }]);
    expect(orphan).toContain('htmlUrl="https://z.com/"');
    expect(orphan).not.toContain('Empty');
  });

  it('rejects invalid files', () => {
    expect(() => parseOpml('<html></html>')).toThrow();
    expect(() => parseOpml('pas du xml')).toThrow();
  });
});
