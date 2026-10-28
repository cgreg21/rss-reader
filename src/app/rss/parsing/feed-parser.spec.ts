import { describe, expect, it } from 'vitest';

import { deduceFeedUrl, discoverFeedUrl, extractReadable, looksLikeHtml, parseFeed, sanitizeHtml, toText } from './feed-parser';

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

describe('sanitizeHtml', () => {
  it('removes scripts and event handlers', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('onclick');
    expect(out).toContain('Hi');
  });

  it('removes javascript: links and hardens anchors', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a><a href="https://e.com">y</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('rel="noopener noreferrer"');
  });
});

describe('toText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(toText('<p>Un   <b>deux</b>\n trois</p>')).toBe('Un deux trois');
  });
});

describe('deduceFeedUrl', () => {
  it('handles Reddit', () => {
    expect(deduceFeedUrl('https://www.reddit.com/r/angular/')).toBe('https://www.reddit.com/r/angular/.rss');
  });

  it('handles YouTube channels and playlists', () => {
    expect(deduceFeedUrl('https://www.youtube.com/channel/UC123')).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UC123');
    expect(deduceFeedUrl('https://www.youtube.com/playlist?list=PL1')).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PL1');
  });

  it('handles Mastodon profiles', () => {
    expect(deduceFeedUrl('https://mastodon.social/@user')).toBe('https://mastodon.social/@user.rss');
  });

  it('returns null for other or invalid addresses', () => {
    expect(deduceFeedUrl('https://example.com/blog')).toBeNull();
    expect(deduceFeedUrl('not a url')).toBeNull();
  });
});

describe('discoverFeedUrl / looksLikeHtml', () => {
  it('finds the advertised feed and resolves relative links', () => {
    const html = '<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>';
    expect(discoverFeedUrl(html, 'https://example.com/blog/')).toBe('https://example.com/feed.xml');
  });

  it('returns null when none is advertised', () => {
    expect(discoverFeedUrl('<head></head>', 'https://example.com')).toBeNull();
  });

  it('detects HTML documents', () => {
    expect(looksLikeHtml('<!DOCTYPE html><html></html>')).toBe(true);
    expect(looksLikeHtml('<?xml version="1.0"?><rss/>')).toBe(false);
  });
});

describe('extractReadable', () => {
  it('keeps the article and absolutizes links', () => {
    const html = '<nav>menu</nav><article><p>Texte</p><a href="/x">lien</a></article><footer>pied</footer>';
    const out = extractReadable(html, 'https://example.com/a/b');
    expect(out).toContain('Texte');
    expect(out).toContain('https://example.com/x');
    expect(out).not.toContain('menu');
    expect(out).not.toContain('pied');
  });

  it('drops share bars, related lists and cookie banners inside the article', () => {
    const body = 'Un long paragraphe. '.repeat(20);
    const html = `<article><p>${body}</p><div class="share-buttons"><a href="/s">Partager</a></div><ul class="x"><li><a href="/1">Un</a></li><li><a href="/2">Deux</a></li><li><a href="/3">Trois</a></li></ul><div id="cookie-banner">cookies</div></article>`;
    const out = extractReadable(html, 'https://example.com');
    expect(out).toContain('long paragraphe');
    expect(out).not.toContain('Partager');
    expect(out).not.toContain('Trois');
    expect(out).not.toContain('cookies');
  });

  it('falls back to the densest container, then the body', () => {
    const html = '<div><p>court</p></div><section><p>un texte nettement plus long</p></section>';
    const out = extractReadable(html, 'https://example.com');
    expect(out).toContain('plus long');
    expect(out).not.toContain('court');
    expect(extractReadable('<p>seul</p>', 'https://example.com')).toContain('seul');
  });
});

describe('error paths', () => {
  it('rejects malformed JSON feeds', () => {
    expect(() => parseFeed('{"items": [', 'f')).toThrow('err.invalidFeed');
    expect(() => parseFeed('{"version":"https://jsonfeed.org/version/1.1"}', 'f')).toThrow('err.invalidFeed');
  });

  it('skips advertised links with an unusable href', () => {
    const html = '<link rel="alternate" type="application/rss+xml" href="http://[bad"><link rel="alternate" type="application/atom+xml" href="/ok">';
    expect(discoverFeedUrl(html, 'https://example.com')).toBe('https://example.com/ok');
  });
});

