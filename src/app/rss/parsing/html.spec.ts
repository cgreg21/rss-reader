import { describe, expect, it } from 'vitest';

import { extractReadable, looksLikeHtml, sanitizeHtml, toText } from './html';

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

describe('looksLikeHtml', () => {
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
