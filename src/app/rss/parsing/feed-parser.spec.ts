import { describe, expect, it } from 'vitest';

import { parseFeed } from './feed-parser';

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Blog</title><link>https://example.com</link>
  <item><title>Premier</title><link>https://example.com/1</link><guid>g1</guid>
    <pubDate>Mon, 06 Jan 2025 10:00:00 GMT</pubDate><description>Résumé</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom blog</title>
  <entry><title>Entrée</title><id>e1</id><link href="https://example.com/e1"/>
    <updated>2025-01-06T10:00:00Z</updated><summary>Texte</summary></entry>
</feed>`;

describe('parseFeed', () => {
  it('parses RSS 2.0', () => {
    const feed = parseFeed(RSS, 'f1');
    expect(feed.format).toBe('RSS 2.0');
    expect(feed.title).toBe('Blog');
    expect(feed.items).toHaveLength(1);
    expect(feed.items[0].title).toBe('Premier');
    expect(feed.items[0].link).toBe('https://example.com/1');
  });

  it('parses Atom', () => {
    const feed = parseFeed(ATOM, 'f1');
    expect(feed.format).toBe('Atom');
    expect(feed.items[0].title).toBe('Entrée');
    expect(feed.items[0].link).toBe('https://example.com/e1');
  });

  it('parses JSON Feed', () => {
    const json = JSON.stringify({
      version: 'https://jsonfeed.org/version/1.1',
      title: 'JSON',
      items: [{ id: '1', url: 'https://example.com/j', title: 'Item', content_text: 'Corps' }],
    });
    const feed = parseFeed(json, 'f1');
    expect(feed.format).toBe('JSON Feed');
    expect(feed.items[0].title).toBe('Item');
  });

  it('rejects invalid input', () => {
    expect(() => parseFeed('pas un flux', 'f1')).toThrow();
  });
});

describe('error paths', () => {
  it('rejects malformed JSON feeds', () => {
    expect(() => parseFeed('{"items": [', 'f')).toThrow('err.invalidFeed');
    expect(() => parseFeed('{"version":"https://jsonfeed.org/version/1.1"}', 'f')).toThrow('err.invalidFeed');
  });
});
