import { Category, Feed } from './models';

export interface OpmlEntry {
  url: string;
  title: string;
  category: string | null;
}

const esc = (v: string): string =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const outline = (f: Feed, indent: string): string =>
  `${indent}<outline type="rss" text="${esc(f.title)}" title="${esc(f.title)}" xmlUrl="${esc(f.url)}"${f.siteUrl ? ` htmlUrl="${esc(f.siteUrl)}"` : ''}/>`;

export function buildOpml(categories: Category[], feeds: Feed[]): string {
  const lines: string[] = [];
  for (const c of categories) {
    const inside = feeds.filter((f) => f.categoryId === c.id);
    if (!inside.length) continue;
    lines.push(`    <outline text="${esc(c.name)}" title="${esc(c.name)}">`, ...inside.map((f) => outline(f, '      ')), '    </outline>');
  }
  const known = new Set(categories.map((c) => c.id));
  lines.push(...feeds.filter((f) => !f.categoryId || !known.has(f.categoryId)).map((f) => outline(f, '    ')));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <head><title>RSS Reader</title></head>\n  <body>\n${lines.join('\n')}\n  </body>\n</opml>\n`;
}

/** Reads feeds from an OPML file; outlines that contain other outlines are treated as categories. */
export function parseOpml(xml: string): OpmlEntry[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.querySelector('opml > body');
  if (doc.querySelector('parsererror') || !body) throw new Error('Fichier OPML invalide');
  const entries: OpmlEntry[] = [];
  const walk = (node: Element, category: string | null): void => {
    for (const child of Array.from(node.children).filter((c) => c.localName === 'outline')) {
      const url = child.getAttribute('xmlUrl')?.trim();
      const label = (child.getAttribute('title') ?? child.getAttribute('text') ?? '').trim();
      if (url) entries.push({ url, title: label || url, category });
      else walk(child, label || category);
    }
  };
  walk(body, null);
  return entries;
}
