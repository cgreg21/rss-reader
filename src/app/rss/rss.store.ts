import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { db } from './db';
import { FetchService } from './fetch.service';
import { deduceFeedUrl, discoverFeedUrl, extractReadable, looksLikeHtml, parseFeed } from './feed-parser';
import { Article, Category, Feed, ParsedFeed } from './models';
import { json, persisted } from './persisted';
import { SettingsStore } from './settings.store';

export type Scope =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'favorites' }
  | { type: 'later' }
  | { type: 'feed'; id: string }
  | { type: 'category'; id: string };

const DEAD_FEED_FAILURES = 5;
const MAX_ARTICLES_PER_FEED = 100;

const toPlainLength = (html: string): number => html.replace(/<[^>]*>/g, '').trim().length;
const startOfToday = (): number => new Date().setHours(0, 0, 0, 0);

/** Article state key shared across devices: the feed-independent part of the article id. */
export const stateKey = (articleId: string): string => articleId.slice(articleId.indexOf(':') + 1);
/** Bit flags: 1 read, 2 favorite, 4 later. */
export const flagsOf = (a: Pick<Article, 'read' | 'favorite' | 'later'>): number => (a.read ? 1 : 0) | (a.favorite ? 2 : 0) | (a.later ? 4 : 0);
const withFlags = (a: Article, flags: number): Article => ({ ...a, read: !!(flags & 1), favorite: !!(flags & 2), later: !!(flags & 4) });

/** Feeds, categories and articles: local library in IndexedDB, refreshed from the network. */
@Injectable({ providedIn: 'root' })
export class RssStore {
  private readonly settings = inject(SettingsStore);
  private readonly net = inject(FetchService);

  readonly feeds = signal<Feed[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly articles = signal<Article[]>([]);
  readonly scope = signal<Scope>({ type: 'all' });
  readonly unreadOnly = signal(true);
  readonly search = signal('');
  readonly syncing = signal(false);
  readonly online = signal(navigator.onLine);
  /** Urls of feeds unfollowed on some device, kept so synchronisation can propagate the removal. */
  readonly removedFeeds = persisted('rssreader:removed-feeds', json<string[]>([]));

  readonly scopeTitle = computed(() => {
    const s = this.scope();
    if (s.type === 'feed') return this.feeds().find((f) => f.id === s.id)?.title ?? '';
    if (s.type === 'category') return this.categories().find((c) => c.id === s.id)?.name ?? '';
    return { all: 'Tous les flux', today: "Aujourd'hui", favorites: 'Favoris', later: 'À lire plus tard' }[s.type];
  });

  readonly visible = computed(() => {
    const s = this.scope();
    const unreadOnly = this.unreadOnly();
    const q = this.search().trim().toLowerCase();
    const muted = this.settings.mutedWords();
    const feedIds = s.type === 'category' ? new Set(this.feeds().filter((f) => f.categoryId === s.id).map((f) => f.id)) : null;
    const today = startOfToday();
    const plain = (a: Article): string => `${a.title} ${a.summary} ${a.content.replace(/<[^>]*>/g, ' ')}`.toLowerCase();
    return this.articles()
      .filter((a) => {
        if (s.type === 'feed' && a.feedId !== s.id) return false;
        if (feedIds && !feedIds.has(a.feedId)) return false;
        if (s.type === 'today' && a.published < today) return false;
        if (s.type === 'favorites' && !a.favorite) return false;
        if (s.type === 'later' && !a.later) return false;
        if (unreadOnly && a.read && s.type !== 'favorites' && s.type !== 'later') return false;
        if (muted.length && !a.favorite && !a.later) {
          const hay = `${a.title} ${a.summary}`.toLowerCase();
          if (muted.some((w) => hay.includes(w))) return false;
        }
        return !q || plain(a).includes(q);
      })
      .sort((a, b) => b.published - a.published);
  });

  readonly unreadByFeed = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.articles()) if (!a.read) counts.set(a.feedId, (counts.get(a.feedId) ?? 0) + 1);
    return counts;
  });
  readonly unreadTotal = computed(() => this.articles().filter((a) => !a.read).length);
  readonly unreadToday = computed(() => {
    const today = startOfToday();
    return this.articles().filter((a) => !a.read && a.published >= today).length;
  });
  readonly favoriteCount = computed(() => this.articles().filter((a) => a.favorite).length);
  readonly laterCount = computed(() => this.articles().filter((a) => a.later).length);
  readonly deadFeeds = computed(() => this.feeds().filter((f) => (f.failures ?? 0) >= DEAD_FEED_FAILURES));

  /** Feeds grouped by category; uncategorised feeds go last. */
  readonly groups = computed(() => {
    const feeds = this.feeds();
    const counts = this.unreadByFeed();
    const unreadOnly = this.unreadOnly();
    const group = (id: string | null, name: string) => {
      const list = feeds
        .filter((f) => f.categoryId === id && (!unreadOnly || (counts.get(f.id) ?? 0) > 0))
        .sort((a, b) => a.title.localeCompare(b.title));
      return { id, name, feeds: list, unread: list.reduce((n, f) => n + (counts.get(f.id) ?? 0), 0) };
    };
    const known = this.categories().slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => group(c.id, c.name))
      .filter((g) => !unreadOnly || g.feeds.length);
    const other = group(null, 'Autres');
    return other.feeds.length ? [...known, other] : known;
  });

  private loaded: Promise<void> | null = null;
  private lastRefresh = 0;
  private autoTimer: ReturnType<typeof setInterval> | null = null;
  /** Feeds re-followed here since the last sync, which must not be removed again by an older remote tombstone. */
  private readonly readded = new Set<string>();
  /** Flags received from sync or a backup, also applied to articles downloaded later. */
  private knownFlags: Record<string, number> = {};

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
    effect(() => {
      this.settings.retentionDays();
      untracked(() => void this.purge());
    });
  }

  private autoRefreshIfDue(): void {
    const minutes = this.settings.autoRefresh();
    if (minutes <= 0 || document.hidden || !navigator.onLine || !this.loaded) return;
    if (Date.now() - this.lastRefresh >= minutes * 60_000) void this.refreshAll();
  }

  load(): Promise<void> {
    this.loaded ??= (async () => {
      const [feeds, categories, articles] = await Promise.all([
        db.all<Feed>('feeds'), db.all<Category>('categories'), db.all<Article>('articles'),
      ]);
      this.feeds.set(feeds);
      this.categories.set(categories);
      this.articles.set(articles);
      if (navigator.onLine) void this.refreshAll();
    })();
    return this.loaded;
  }

  article(id: string): Article | undefined {
    return this.articles().find((a) => a.id === id);
  }

  // ---- feeds and categories ----

  newFeedId(): string {
    return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  async addFeed(rawUrl: string, categoryId: string | null): Promise<void> {
    let url = deduceFeedUrl(rawUrl.trim()) ?? new URL(rawUrl.trim()).href;
    let body = await this.net.download(url);
    if (looksLikeHtml(body)) {
      const discovered = discoverFeedUrl(body, url);
      if (!discovered) throw new Error('Aucun flux trouvé sur cette page');
      url = discovered;
      body = await this.net.download(url);
    }
    if (this.feeds().some((f) => f.url === url)) throw new Error('Flux déjà suivi');
    this.noteFollowed(url);
    const id = this.newFeedId();
    const parsed = parseFeed(body, id);
    await this.putFeed({ id, url, title: parsed.title || new URL(url).hostname, siteUrl: parsed.siteUrl, description: parsed.description, format: parsed.format, categoryId, lastFetched: Date.now() });
    await this.merge(id, parsed.items);
  }

  /** Inserts or replaces a feed. */
  async putFeed(feed: Feed): Promise<void> {
    await db.put('feeds', feed);
    this.feeds.update((l) => (l.some((f) => f.id === feed.id) ? l.map((f) => (f.id === feed.id ? feed : f)) : [...l, feed]));
  }

  async removeFeed(id: string): Promise<void> {
    const url = this.feeds().find((f) => f.id === id)?.url;
    if (url) this.removedFeeds.set([...new Set([...this.removedFeeds(), url])]);
    await this.dropFeed(id);
  }

  /** Removes a feed and its articles without recording a tombstone. */
  async dropFeed(id: string): Promise<void> {
    await db.remove('feeds', id);
    for (const a of this.articles().filter((x) => x.feedId === id)) await db.remove('articles', a.id);
    this.feeds.update((l) => l.filter((f) => f.id !== id));
    this.articles.update((l) => l.filter((a) => a.feedId !== id));
    const s = this.scope();
    if (s.type === 'feed' && s.id === id) this.scope.set({ type: 'all' });
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
    const category = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: trimmed };
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
    const s = this.scope();
    if (s.type === 'category' && s.id === id) this.scope.set({ type: 'all' });
  }

  // ---- articles ----

  async refreshAll(): Promise<void> {
    if (this.syncing() || !navigator.onLine) return;
    this.syncing.set(true);
    try {
      await Promise.all(this.feeds().map((f) => this.refreshFeed(f)));
    } finally {
      this.lastRefresh = Date.now();
      this.syncing.set(false);
    }
    await this.purge();
  }

  async purge(): Promise<void> {
    const days = this.settings.retentionDays();
    if (days <= 0) return;
    const limit = Date.now() - days * 86_400_000;
    const stale = this.articles().filter((a) => a.read && !a.favorite && !a.later && a.published < limit);
    if (!stale.length) return;
    for (const a of stale) await db.remove('articles', a.id);
    const gone = new Set(stale.map((a) => a.id));
    this.articles.update((l) => l.filter((a) => !gone.has(a.id)));
  }

  async patch(id: string, changes: Partial<Pick<Article, 'read' | 'favorite' | 'later'>>): Promise<void> {
    const article = this.article(id);
    if (!article) return;
    const updated = { ...article, ...changes };
    this.articles.update((l) => l.map((a) => (a.id === id ? updated : a)));
    await db.put('articles', updated);
  }

  async markAllRead(): Promise<void> {
    const changed = this.visible().filter((a) => !a.read).map((a) => ({ ...a, read: true }));
    const ids = new Set(changed.map((a) => a.id));
    this.articles.update((l) => l.map((a) => (ids.has(a.id) ? { ...a, read: true } : a)));
    await db.putMany('articles', changed);
  }

  /** Merges (OR) state flags keyed by `stateKey` into current articles, and remembers them for articles not downloaded yet. */
  async applyFlags(states: Record<string, number>): Promise<void> {
    this.knownFlags = { ...this.knownFlags, ...states };
    const changed: Article[] = [];
    const next = this.articles().map((a) => {
      const merged = flagsOf(a) | (states[stateKey(a.id)] ?? 0);
      if (merged === flagsOf(a)) return a;
      const updated = withFlags(a, merged);
      changed.push(updated);
      return updated;
    });
    if (!changed.length) return;
    this.articles.set(next);
    await db.putMany('articles', changed);
  }

  /** Downloads the article's web page and replaces its content with the extracted full text. */
  async fetchFullText(id: string): Promise<void> {
    const article = this.article(id);
    if (!article?.link) throw new Error("Pas d'adresse d'origine");
    const content = extractReadable(await this.net.download(article.link), article.link);
    if (toPlainLength(content) < 200) throw new Error('Texte complet introuvable');
    const updated = { ...article, content, fullText: true };
    this.articles.update((l) => l.map((a) => (a.id === id ? updated : a)));
    await db.put('articles', updated);
  }

  private async refreshFeed(feed: Feed): Promise<void> {
    let updated: Feed;
    try {
      const parsed = parseFeed(await this.net.download(feed.url), feed.id);
      await this.merge(feed.id, parsed.items);
      updated = { ...feed, siteUrl: feed.siteUrl ?? parsed.siteUrl, description: parsed.description ?? feed.description, format: parsed.format, lastFetched: Date.now(), error: undefined, failures: 0 };
    } catch (error) {
      updated = { ...feed, error: error instanceof Error ? error.message : 'Erreur', failures: (feed.failures ?? 0) + 1 };
    }
    await db.put('feeds', updated);
    this.feeds.update((l) => l.map((f) => (f.id === feed.id ? updated : f)));
  }

  private async merge(feedId: string, items: ParsedFeed['items']): Promise<void> {
    const existing = new Set(this.articles().map((a) => a.id));
    const fresh: Article[] = items
      .filter((i) => !existing.has(i.id))
      .map((i) => withFlags({ ...i, feedId, read: false, favorite: false }, this.knownFlags[stateKey(i.id)] ?? 0));
    if (!fresh.length) return;
    await db.putMany('articles', fresh);
    const all = [...this.articles(), ...fresh];
    const stale = all
      .filter((a) => a.feedId === feedId && !a.favorite)
      .sort((a, b) => b.published - a.published)
      .slice(MAX_ARTICLES_PER_FEED);
    for (const a of stale) await db.remove('articles', a.id);
    const dropped = new Set(stale.map((a) => a.id));
    this.articles.set(all.filter((a) => !dropped.has(a.id)));
  }
}
