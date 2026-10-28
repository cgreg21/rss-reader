import { Injectable, effect, inject, signal } from '@angular/core';

import { ArticlesStore } from '../articles.store';
import { FeedsStore } from '../feeds.store';
import { parseFeed } from '../feed-parser';
import { Feed } from '../models';
import { SettingsStore } from '../settings.store';
import { FetchService } from './fetch.service';

/** Loads the library and refreshes it from the network, on demand, when back online and periodically. */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  private readonly settings = inject(SettingsStore);
  private readonly net = inject(FetchService);
  private readonly feedsStore = inject(FeedsStore);
  private readonly articlesStore = inject(ArticlesStore);

  readonly syncing = signal(false);
  readonly online = signal(navigator.onLine);

  private loaded: Promise<void> | null = null;
  private lastRefresh = 0;
  private autoTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.refreshAll();
    });
    window.addEventListener('offline', () => this.online.set(false));
    document.addEventListener('visibilitychange', () => this.autoRefreshIfDue());
    effect(() => {
      const minutes = this.settings.autoRefresh();
      if (this.autoTimer) clearInterval(this.autoTimer);
      this.autoTimer = minutes > 0 ? setInterval(() => this.autoRefreshIfDue(), 30_000) : null;
    });
  }

  load(): Promise<void> {
    this.loaded ??= (async () => {
      await Promise.all([this.feedsStore.load(), this.articlesStore.load()]);
      if (navigator.onLine) void this.refreshAll();
    })();
    return this.loaded;
  }

  async refreshAll(): Promise<void> {
    if (this.syncing() || !navigator.onLine) return;
    this.syncing.set(true);
    try {
      await Promise.allSettled(this.feedsStore.feeds().map((f) => this.refreshFeed(f)));
    } finally {
      this.lastRefresh = Date.now();
      this.syncing.set(false);
    }
    await this.articlesStore.purge();
  }

  private autoRefreshIfDue(): void {
    const minutes = this.settings.autoRefresh();
    if (minutes <= 0 || document.hidden || !navigator.onLine || !this.loaded) return;
    if (Date.now() - this.lastRefresh >= minutes * 60_000) void this.refreshAll();
  }

  private async refreshFeed(feed: Feed): Promise<void> {
    let updated: Feed;
    try {
      const parsed = parseFeed(await this.net.download(feed.url), feed.id);
      await this.articlesStore.merge(feed.id, parsed.items);
      updated = { ...feed, siteUrl: feed.siteUrl ?? parsed.siteUrl, description: parsed.description ?? feed.description, format: parsed.format, lastFetched: Date.now(), error: undefined, failures: 0 };
    } catch (error) {
      updated = { ...feed, error: error instanceof Error ? error.message : 'Erreur', failures: (feed.failures ?? 0) + 1 };
    }
    await this.feedsStore.updateFeed(updated);
  }
}
