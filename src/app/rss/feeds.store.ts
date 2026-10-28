import { Injectable, computed, inject, signal } from '@angular/core';

import { MessageError } from '../i18n/message-error';
import { ArticlesStore } from './articles.store';
import { db } from './db';
import { deduceFeedUrl, discoverFeedUrl, looksLikeHtml, parseFeed } from './feed-parser';
import { newId } from './ids';
import { Category, Feed } from './models';
import { json, persisted } from './persisted';
import { FetchService } from './services/fetch.service';

export type FeedRemoval = { kind: 'feed' | 'category'; id: string };

const DEAD_FEED_FAILURES = 5;

/** Followed feeds and their categories, kept in IndexedDB. */
@Injectable({ providedIn: 'root' })
export class FeedsStore {
  private readonly net = inject(FetchService);
  private readonly articlesStore = inject(ArticlesStore);

  readonly feeds = signal<Feed[]>([]);
  readonly categories = signal<Category[]>([]);
  /** Urls of feeds unfollowed on some device, kept so synchronisation can propagate the removal. */
  readonly removedFeeds = persisted('rssreader:removed-feeds', json<string[]>([]));
  readonly deadFeeds = computed(() => this.feeds().filter((f) => (f.failures ?? 0) >= DEAD_FEED_FAILURES));

  /** Feeds re-followed here since the last sync, which must not be removed again by an older remote tombstone. */
  private readonly readded = new Set<string>();
  private readonly removalListeners: ((removal: FeedRemoval) => void)[] = [];

  async load(): Promise<void> {
    const [feeds, categories] = await Promise.all([db.all<Feed>('feeds'), db.all<Category>('categories')]);
    this.feeds.set(feeds);
    this.categories.set(categories);
  }

  /** Calls `listener` after a feed or a category was removed. */
  onRemoved(listener: (removal: FeedRemoval) => void): void {
    this.removalListeners.push(listener);
  }

  async addFeed(rawUrl: string, categoryId: string | null): Promise<void> {
    let url = deduceFeedUrl(rawUrl.trim()) ?? new URL(rawUrl.trim()).href;
    let body = await this.net.download(url);
    if (looksLikeHtml(body)) {
      const discovered = discoverFeedUrl(body, url);
      if (!discovered) throw new MessageError('err.noFeedFound');
      url = discovered;
      body = await this.net.download(url);
    }
    if (this.feeds().some((f) => f.url === url)) throw new MessageError('err.alreadyFollowed');
    this.noteFollowed(url);
    const id = newId('f');
    const parsed = parseFeed(body, id);
    await this.putFeed({ id, url, title: parsed.title || new URL(url).hostname, siteUrl: parsed.siteUrl, description: parsed.description, format: parsed.format, categoryId, lastFetched: Date.now() });
    await this.articlesStore.merge(id, parsed.items);
  }

  /** Inserts or replaces a feed. */
  async putFeed(feed: Feed): Promise<void> {
    await db.put('feeds', feed);
    this.feeds.update((l) => (l.some((f) => f.id === feed.id) ? l.map((f) => (f.id === feed.id ? feed : f)) : [...l, feed]));
  }

  /** Saves a refreshed feed, ignoring it when it was unfollowed meanwhile. */
  async updateFeed(feed: Feed): Promise<void> {
    await db.put('feeds', feed);
    this.feeds.update((l) => l.map((f) => (f.id === feed.id ? feed : f)));
  }

  async removeFeed(id: string): Promise<void> {
    const url = this.feeds().find((f) => f.id === id)?.url;
    if (url) this.removedFeeds.set([...new Set([...this.removedFeeds(), url])]);
    await this.dropFeed(id);
  }

  /** Removes a feed and its articles without recording a tombstone. */
  async dropFeed(id: string): Promise<void> {
    await db.remove('feeds', id);
    await this.articlesStore.removeFeed(id);
    this.feeds.update((l) => l.filter((f) => f.id !== id));
    this.notifyRemoved({ kind: 'feed', id });
  }

  /** Records that the user follows `url` here, cancelling a pending removal tombstone. */
  noteFollowed(url: string): void {
    if (!this.removedFeeds().includes(url)) return;
    this.readded.add(url);
    this.removedFeeds.set(this.removedFeeds().filter((u) => u !== url));
  }

  wasReadded(url: string): boolean {
    return this.readded.has(url);
  }

  markSynced(): void {
    this.readded.clear();
  }

  async setFeedCategory(feedId: string, categoryId: string | null): Promise<void> {
    const feed = this.feeds().find((f) => f.id === feedId);
    if (feed) await this.putFeed({ ...feed, categoryId });
  }

  async addCategory(name: string): Promise<void> {
    await this.categoryIdFor(name);
  }

  /** Id of the category with this name (case-insensitive), created when missing. */
  async categoryIdFor(name: string | null | undefined): Promise<string | null> {
    const trimmed = name?.trim();
    if (!trimmed) return null;
    const existing = this.categories().find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;
    const category = { id: newId('c'), name: trimmed };
    await this.putCategory(category);
    return category.id;
  }

  async putCategory(category: Category): Promise<void> {
    if (this.categories().some((c) => c.id === category.id)) return;
    await db.put('categories', category);
    this.categories.update((l) => [...l, category]);
  }

  async removeCategory(id: string): Promise<void> {
    await db.remove('categories', id);
    this.categories.update((l) => l.filter((c) => c.id !== id));
    for (const f of this.feeds().filter((x) => x.categoryId === id)) await this.setFeedCategory(f.id, null);
    this.notifyRemoved({ kind: 'category', id });
  }

  private notifyRemoved(removal: FeedRemoval): void {
    for (const listener of this.removalListeners) listener(removal);
  }
}
