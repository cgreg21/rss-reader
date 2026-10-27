import { FeedFormat, ParsedFeed } from './models';

const BLOCKED = 'script,iframe,object,embed,style,link,form,meta';

/** Removes active content and event handlers from remote HTML before it is stored and displayed. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(BLOCKED).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value.trim().toLowerCase();
      if (attr.name.startsWith('on') || ((attr.name === 'href' || attr.name === 'src') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy');
  });
  return doc.body.innerHTML;
}

export function toText(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

function first(parent: Element, ...names: string[]): Element | null {
  for (const name of names) {
    const found = Array.from(parent.children).find((c) => c.localName === name);
    if (found) return found;
  }
  return null;
}

function text(parent: Element, ...names: string[]): string {
  return first(parent, ...names)?.textContent?.trim() ?? '';
}

function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const FEED_LINK_TYPES = /^application\/(rss\+xml|atom\+xml|feed\+json|json|rdf\+xml)$/i;

export const looksLikeHtml = (body: string): boolean => /^\s*(<!doctype\s+html|<html[\s>])/i.test(body);

/** Finds the feed advertised by a web page through its <link rel="alternate"> tags. */
export function discoverFeedUrl(html: string, baseUrl: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const link of Array.from(doc.querySelectorAll('link[rel~="alternate"][href]'))) {
    if (!FEED_LINK_TYPES.test(link.getAttribute('type')?.trim() ?? '')) continue;
    try {
      return new URL(link.getAttribute('href') ?? '', baseUrl).href;
    } catch {
      continue;
    }
  }
  return null;
}

interface JsonFeedItem {
  id?: string | number;
  url?: string;
  external_url?: string;
  title?: string;
  content_html?: string;
  content_text?: string;
  summary?: string;
  image?: string;
  banner_image?: string;
  date_published?: string;
  date_modified?: string;
}

function parseJsonFeed(json: string, feedId: string): ParsedFeed {
  let data: { title?: string; description?: string; home_page_url?: string; items?: JsonFeedItem[] };
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Flux invalide');
  }
  if (!data || !Array.isArray(data.items)) throw new Error('Flux invalide');
  const items = data.items.map((item) => {
    const link = item.url ?? item.external_url ?? '';
    const escaped = (item.content_text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
    const content = sanitizeHtml(item.content_html ?? (escaped ? `<p>${escaped.replace(/\n/g, '<br>')}</p>` : ''));
    const date = Date.parse(item.date_published ?? item.date_modified ?? '');
    const title = toText(item.title ?? '');
    return {
      id: `${feedId}:${hash(String(item.id ?? (link || title)))}`,
      title: title || '(sans titre)',
      link,
      summary: toText(item.summary ?? content ?? '').slice(0, 280),
      content,
      image: item.image ?? item.banner_image ?? new DOMParser().parseFromString(content, 'text/html').querySelector('img')?.getAttribute('src') ?? undefined,
      published: Number.isNaN(date) ? Date.now() : date,
    };
  });
  return { title: toText(data.title ?? ''), siteUrl: data.home_page_url, description: toText(data.description ?? '') || undefined, format: 'JSON Feed', items };
}

export function parseFeed(xml: string, feedId: string): ParsedFeed {
  if (xml.trimStart().startsWith('{')) return parseJsonFeed(xml, feedId);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.documentElement) throw new Error('Flux invalide');
  const root = doc.documentElement;
  const isAtom = root.localName === 'feed';
  const isRdf = root.localName === 'RDF';
  const channel = isAtom ? root : first(root, 'channel');
  if (!channel) throw new Error('Flux invalide');

  // RSS 1.0 (RDF) lists its items next to the channel instead of inside it.
  const entries = Array.from(isAtom || isRdf ? root.children : channel.children).filter((c) => c.localName === (isAtom ? 'entry' : 'item'));
  const siteLink = isAtom
    ? Array.from(channel.children).find((c) => c.localName === 'link' && (c.getAttribute('rel') ?? 'alternate') === 'alternate')?.getAttribute('href') ?? undefined
    : text(channel, 'link') || undefined;

  const items = entries.map((entry) => {
    const link = isAtom
      ? Array.from(entry.children).find((c) => c.localName === 'link' && (c.getAttribute('rel') ?? 'alternate') === 'alternate')?.getAttribute('href') ?? ''
      : text(entry, 'link');
    const rawContent = text(entry, 'encoded', 'content') || text(entry, 'description', 'summary');
    const rawSummary = text(entry, 'description', 'summary') || rawContent;
    const date = Date.parse(text(entry, 'pubDate', 'published', 'updated', 'date'));
    const guid = text(entry, 'guid', 'id') || link || text(entry, 'title');
    const content = sanitizeHtml(rawContent);
    const media = Array.from(entry.children).find(
      (c) => (c.localName === 'thumbnail' || c.localName === 'content' || c.localName === 'enclosure') && c.getAttribute('url')
        && (c.getAttribute('type')?.startsWith('image') || c.localName === 'thumbnail' || c.getAttribute('medium') === 'image'),
    )?.getAttribute('url');
    const image = media ?? new DOMParser().parseFromString(content, 'text/html').querySelector('img')?.getAttribute('src') ?? undefined;
    return {
      id: `${feedId}:${hash(guid)}`,
      title: toText(text(entry, 'title')) || '(sans titre)',
      link,
      summary: toText(rawSummary).slice(0, 280),
      content,
      image,
      published: Number.isNaN(date) ? Date.now() : date,
    };
  });

  const description = toText(text(channel, 'description', 'subtitle')) || undefined;
  const format: FeedFormat = isAtom ? 'Atom' : isRdf ? 'RSS 1.0 (RDF)' : 'RSS 2.0';
  return { title: toText(text(channel, 'title')), siteUrl: siteLink, description, format, items };
}
