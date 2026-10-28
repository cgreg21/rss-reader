import { Injectable, inject } from '@angular/core';

import { SettingsStore } from '../settings.store';

export interface FeedHit {
  url: string;
  title: string;
  website?: string;
  description?: string;
  subscribers?: number;
}

/** Network access for feeds, pages and images, through the CORS proxy when it is enabled. */
@Injectable({ providedIn: 'root' })
export class FetchService {
  private readonly settings = inject(SettingsStore);

  request(url: string): Promise<Response> {
    const proxy = this.settings.activeProxy();
    if (!proxy) return fetch(url);
    // budget-caldav-proxy contract: same path and query on the proxy, target origin in X-Upstream.
    const target = new URL(url);
    return fetch(proxy + target.pathname + target.search, { credentials: 'omit', headers: { 'X-Upstream': target.origin } });
  }

  async download(url: string): Promise<string> {
    const response = await this.request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  /** Searches feeds online (Feedly public directory); also accepts a site URL. */
  async searchFeeds(query: string): Promise<FeedHit[]> {
    const text = await this.download(`https://cloud.feedly.com/v3/search/feeds?count=20&query=${encodeURIComponent(query.trim())}`);
    const data = JSON.parse(text) as { results?: { feedId: string; title?: string; website?: string; description?: string; subscribers?: number }[] };
    return (data.results ?? [])
      .filter((r) => r.feedId?.startsWith('feed/'))
      .map((r) => ({ url: r.feedId.slice(5), title: r.title ?? r.feedId.slice(5), website: r.website, description: r.description, subscribers: r.subscribers }));
  }
}
