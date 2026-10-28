import { MessageError } from '../../i18n/message-error';
import { FeedFormat, Media, ParsedFeed } from '../models';
import { sanitizeHtml, toText } from './html';

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
  attachments?: { url?: string; mime_type?: string }[];
}

function parseJsonFeed(json: string, feedId: string): ParsedFeed {
  let data: { title?: string; description?: string; home_page_url?: string; icon?: string; items?: JsonFeedItem[] };
  try {
    data = JSON.parse(json);
  } catch {
    throw new MessageError('err.invalidFeed');
  }
  if (!data || !Array.isArray(data.items)) throw new MessageError('err.invalidFeed');
  const items = data.items.map((item) => {
    const link = item.url ?? item.external_url ?? '';
    const escaped = (item.content_text ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c);
    const content = sanitizeHtml(item.content_html ?? (escaped ? `<p>${escaped.replace(/\n/g, '<br>')}</p>` : ''));
    const date = Date.parse(item.date_published ?? item.date_modified ?? '');
    const title = toText(item.title ?? '');
    const attachment = item.attachments?.find((x) => /^(audio|video)\//.test(x.mime_type ?? ''));
    return {
      id: `${feedId}:${hash(String(item.id ?? (link || title)))}`,
      title: title || '(sans titre)',
      link,
      summary: toText(item.summary ?? content ?? '').slice(0, 280),
      content,
      media: attachment?.url ? { url: attachment.url, kind: attachment.mime_type?.startsWith('video') ? ('video' as const) : ('audio' as const) } : undefined,
      image: item.image ?? item.banner_image ?? new DOMParser().parseFromString(content, 'text/html').querySelector('img')?.getAttribute('src') ?? undefined,
      published: Number.isNaN(date) ? Date.now() : date,
    };
  });
  return { title: toText(data.title ?? ''), siteUrl: data.home_page_url, description: toText(data.description ?? '') || undefined, image: data.icon, format: 'JSON Feed', items };
}

export function parseFeed(xml: string, feedId: string): ParsedFeed {
  if (xml.trimStart().startsWith('{')) return parseJsonFeed(xml, feedId);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.documentElement) throw new MessageError('err.invalidFeed');
  const root = doc.documentElement;
  const isAtom = root.localName === 'feed';
  const isRdf = root.localName === 'RDF';
  const channel = isAtom ? root : first(root, 'channel');
  if (!channel) throw new MessageError('err.invalidFeed');

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
    const youtubeId = text(entry, 'videoId');
    const enclosure = Array.from(entry.children).find(
      (c) => (c.localName === 'enclosure' || (c.localName === 'link' && c.getAttribute('rel') === 'enclosure')) && /^(audio|video)\//.test(c.getAttribute('type') ?? ''),
    );
    const enclosureUrl = enclosure?.getAttribute('url') ?? enclosure?.getAttribute('href');
    const mediaItem: Media | undefined = youtubeId
      ? { url: youtubeId, kind: 'youtube' }
      : enclosureUrl ? { url: enclosureUrl, kind: enclosure?.getAttribute('type')?.startsWith('video') ? 'video' : 'audio' } : undefined;
    return {
      id: `${feedId}:${hash(guid)}`,
      title: toText(text(entry, 'title')) || '(sans titre)',
      link,
      summary: toText(rawSummary).slice(0, 280),
      content,
      image,
      media: mediaItem,
      published: Number.isNaN(date) ? Date.now() : date,
    };
  });

  const description = toText(text(channel, 'description', 'subtitle')) || undefined;
  const format: FeedFormat = isAtom ? 'Atom' : isRdf ? 'RSS 1.0 (RDF)' : 'RSS 2.0';
  return { title: toText(text(channel, 'title')), siteUrl: siteLink, description, image: channelImage(channel), format, items };
}

/** Cover of the feed: itunes:image, RSS <image><url>, or Atom logo / icon. */
function channelImage(channel: Element): string | undefined {
  const children = Array.from(channel.children);
  const itunes = children.find((c) => c.localName === 'image' && c.getAttribute('href'))?.getAttribute('href');
  const rss = children.find((c) => c.localName === 'image')?.querySelector('url')?.textContent?.trim();
  const atom = children.find((c) => c.localName === 'logo' || c.localName === 'icon')?.textContent?.trim();
  const url = itunes || rss || atom;
  return url && /^https?:/i.test(url) ? url : undefined;
}
