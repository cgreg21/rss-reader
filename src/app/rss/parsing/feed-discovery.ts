const FEED_LINK_TYPES = /^application\/(rss\+xml|atom\+xml|feed\+json|json|rdf\+xml)$/i;

/** Feed URL implied by a Reddit, YouTube or Mastodon address, or null for anything else. */
export function deduceFeedUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|old)\./, '');
  const path = url.pathname.replace(/\/+$/, '');
  if (host === 'reddit.com' && /^\/(r|u|user)\/[^/]+$/.test(path)) return `https://www.reddit.com${path}/.rss`;
  if (host === 'youtube.com') {
    const channel = /^\/channel\/([\w-]+)/.exec(path);
    if (channel) return `https://www.youtube.com/feeds/videos.xml?channel_id=${channel[1]}`;
    const playlist = url.searchParams.get('list');
    if (path === '/playlist' && playlist) return `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlist}`;
  }
  // Mastodon-style profile: https://instance/@user (the HTML page is also discoverable, this skips a request).
  if (/^\/@[\w.-]+$/.test(path) && host !== 'youtube.com' && host !== 'medium.com') return `${url.origin}${path}.rss`;
  return null;
}

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
