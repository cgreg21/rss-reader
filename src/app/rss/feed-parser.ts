import { ParsedFeed } from './models';

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

export function parseFeed(xml: string, feedId: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.documentElement) throw new Error('Flux invalide');
  const root = doc.documentElement;
  const isAtom = root.localName === 'feed';
  const channel = isAtom ? root : first(root, 'channel');
  if (!channel) throw new Error('Flux invalide');

  const entries = Array.from(isAtom ? root.children : channel.children).filter((c) => c.localName === (isAtom ? 'entry' : 'item'));
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

  return { title: toText(text(channel, 'title')), siteUrl: siteLink, items };
}
