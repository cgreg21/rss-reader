import { Injectable, inject } from '@angular/core';

import { SettingsStore } from '../settings.store';

export interface FeedHit {
  url: string;
  title: string;
  website?: string;
  description?: string;
  subscribers?: number;
  image?: string;
}

/** Network access for feeds, pages and images, through the CORS proxy when it is enabled. */
@Injectable({ providedIn: 'root' })
export class FetchService {
  private readonly settings = inject(SettingsStore);

  /** Direct request, without the proxy (fallback when the proxy cannot reach a file). */
  direct(url: string, signal?: AbortSignal): Promise<Response> {
    return signal ? fetch(url, { signal }) : fetch(url);
  }

  request(url: string, signal?: AbortSignal): Promise<Response> {
    const proxy = this.settings.activeProxy();
    if (!proxy) return this.direct(url, signal);
    // budget-caldav-proxy contract: same path and query on the proxy, target origin in X-Upstream.
    const target = new URL(url);
    return fetch(proxy + target.pathname + target.search, { credentials: 'omit', headers: { 'X-Upstream': target.origin }, ...(signal ? { signal } : {}) });
  }

  async download(url: string): Promise<string> {
    const response = await this.request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  /** Searches feeds online (Feedly directory and Apple Podcasts); also accepts a site URL. */
  async searchFeeds(query: string): Promise<FeedHit[]> {
    const [feedly, podcasts] = await Promise.allSettled([this.searchFeedly(query), this.searchPodcasts(query)]);
    if (feedly.status === 'rejected' && podcasts.status === 'rejected') throw feedly.reason;
    const hits = [...(podcasts.status === 'fulfilled' ? podcasts.value : []), ...(feedly.status === 'fulfilled' ? feedly.value : [])];
    const seen = new Set<string>();
    return hits.filter((h) => !seen.has(h.url) && !!seen.add(h.url));
  }

  private async searchPodcasts(query: string): Promise<FeedHit[]> {
    const text = await this.download(`https://itunes.apple.com/search?media=podcast&limit=20&term=${encodeURIComponent(query.trim())}`);
    const data = JSON.parse(text) as { results?: { feedUrl?: string; collectionName?: string; artistName?: string; collectionViewUrl?: string; artworkUrl100?: string; artworkUrl600?: string }[] };
    return (data.results ?? [])
      .filter((r) => r.feedUrl)
      .map((r) => ({ url: r.feedUrl!, title: r.collectionName ?? r.feedUrl!, website: r.collectionViewUrl, description: r.artistName, image: r.artworkUrl100 ?? r.artworkUrl600 }));
  }

  private async searchFeedly(query: string): Promise<FeedHit[]> {
    const text = await this.download(`https://cloud.feedly.com/v3/search/feeds?count=20&query=${encodeURIComponent(query.trim())}`);
    const data = JSON.parse(text) as { results?: { feedId: string; title?: string; website?: string; description?: string; subscribers?: number; visualUrl?: string; iconUrl?: string }[] };
    return (data.results ?? [])
      .filter((r) => r.feedId?.startsWith('feed/'))
      .map((r) => ({ url: r.feedId.slice(5), title: r.title ?? r.feedId.slice(5), website: r.website, description: r.description, subscribers: r.subscribers, image: r.visualUrl ?? r.iconUrl }));
  }
}
