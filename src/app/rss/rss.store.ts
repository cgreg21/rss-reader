import { Injectable, computed, signal } from '@angular/core';

import { db } from './db';
import { parseFeed } from './feed-parser';
import { Article, Category, Feed } from './models';
import { buildOpml, parseOpml } from './opml';

export type Scope =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'favorites' }
  | { type: 'feed'; id: string }
  | { type: 'category'; id: string };

const PROXY_KEY = 'rssreader:caldav-proxy';
const PROXY_ENABLED_KEY = 'rssreader:proxy-enabled';
const AUTO_REFRESH_KEY = 'rssreader:auto-refresh';
const DEFAULT_PROXY = '';

/** The proxy relays the path as is, so only its origin matters; an invalid value means no proxy. */
const proxyOrigin = (value: string): string => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
  } catch {
    return '';
  }
};
const MAX_ARTICLES_PER_FEED = 100;

const startOfToday = (): number => new Date().setHours(0, 0, 0, 0);

export type ArticleLayout = 'list' | 'detail' | 'card';
const LAYOUT_KEY = 'rssreader:layout';
const readLayout = (): ArticleLayout => {
  const value = localStorage.getItem(LAYOUT_KEY);
  return value === 'list' || value === 'card' ? value : 'detail';
};

@Injectable({ providedIn: 'root' })
export class RssStore {
  readonly feeds = signal<Feed[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly articles = signal<Article[]>([]);
  readonly scope = signal<Scope>({ type: 'all' });
  readonly unreadOnly = signal(true);
  readonly search = signal('');
  readonly syncing = signal(false);
  readonly online = signal(navigator.onLine);
  readonly proxy = signal(localStorage.getItem(PROXY_KEY) ?? DEFAULT_PROXY);
  readonly proxyEnabled = signal(localStorage.getItem(PROXY_ENABLED_KEY) !== '0');
  readonly layout = signal<ArticleLayout>(readLayout());
  /** Minutes between automatic refreshes while online; 0 disables it. */
  readonly autoRefresh = signal(Number(localStorage.getItem(AUTO_REFRESH_KEY) ?? 15) || 0);

  setLayout(value: ArticleLayout): void {
    this.layout.set(value);
    localStorage.setItem(LAYOUT_KEY, value);
  }

  readonly scopeTitle = computed(() => {
    const s = this.scope();
    if (s.type === 'feed') return this.feeds().find((f) => f.id === s.id)?.title ?? '';
    if (s.type === 'category') return this.categories().find((c) => c.id === s.id)?.name ?? '';
    return { all: 'Tous les flux', today: "Aujourd'hui", favorites: 'Favoris' }[s.type];
  });

  readonly visible = computed(() => {
    const s = this.scope();
    const unreadOnly = this.unreadOnly();
    const q = this.search().trim().toLowerCase();
    const feedIds = s.type === 'category' ? new Set(this.feeds().filter((f) => f.categoryId === s.id).map((f) => f.id)) : null;
    const today = startOfToday();
    return this.articles()
      .filter((a) => {
        if (s.type === 'feed' && a.feedId !== s.id) return false;
        if (feedIds && !feedIds.has(a.feedId)) return false;
        if (s.type === 'today' && a.published < today) return false;
        if (s.type === 'favorites' && !a.favorite) return false;
        if (unreadOnly && a.read && s.type !== 'favorites') return false;
        return !q || `${a.title} ${a.summary}`.toLowerCase().includes(q);
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

  constructor() {
    window.addEventListener('online', () => {
      this.online.set(true);
      void this.refreshAll();
    });
    window.addEventListener('offline', () => this.online.set(false));
    document.addEventListener('visibilitychange', () => this.autoRefreshIfDue());
    this.scheduleAutoRefresh();
  }

  setAutoRefresh(minutes: number): void {
    this.autoRefresh.set(minutes);
    localStorage.setItem(AUTO_REFRESH_KEY, String(minutes));
    this.scheduleAutoRefresh();
  }

  private scheduleAutoRefresh(): void {
    if (this.autoTimer) clearInterval(this.autoTimer);
    this.autoTimer = this.autoRefresh() > 0 ? setInterval(() => this.autoRefreshIfDue(), 30_000) : null;
  }

  private autoRefreshIfDue(): void {
    const minutes = this.autoRefresh();
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

  setProxy(value: string): void {
    this.proxy.set(value.trim());
    localStorage.setItem(PROXY_KEY, this.proxy());
  }

  setProxyEnabled(value: boolean): void {
    this.proxyEnabled.set(value);
    localStorage.setItem(PROXY_ENABLED_KEY, value ? '1' : '0');
  }

  async addFeed(rawUrl: string, categoryId: string | null): Promise<void> {
    const url = new URL(rawUrl.trim()).href;
    if (this.feeds().some((f) => f.url === url)) throw new Error('Flux déjà suivi');
    const id = `f${Date.now().toString(36)}`;
    const parsed = parseFeed(await this.download(url), id);
    const feed: Feed = { id, url, title: parsed.title || new URL(url).hostname, siteUrl: parsed.siteUrl, categoryId, lastFetched: Date.now() };
    await db.put('feeds', feed);
    this.feeds.update((l) => [...l, feed]);
    await this.merge(feed.id, parsed.items);
  }

  async importOpml(xml: string): Promise<{ added: number; skipped: number }> {
    const entries = parseOpml(xml);
    let added = 0;
    let skipped = 0;
    const known = new Set(this.feeds().map((f) => f.url));
    for (const entry of entries) {
      let url: string;
      try {
        url = new URL(entry.url).href;
      } catch {
        skipped++;
        continue;
      }
      if (known.has(url)) {
        skipped++;
        continue;
      }
      known.add(url);
      let categoryId: string | null = null;
      if (entry.category) {
        await this.addCategory(entry.category);
        categoryId = this.categories().find((c) => c.name.toLowerCase() === entry.category!.toLowerCase())?.id ?? null;
      }
      const feed: Feed = { id: `f${Date.now().toString(36)}${added}`, url, title: entry.title, categoryId };
      await db.put('feeds', feed);
      this.feeds.update((l) => [...l, feed]);
      added++;
    }
    if (added) void this.refreshAll();
    return { added, skipped };
  }

  exportOpml(): string {
    return buildOpml(this.categories(), this.feeds());
  }

  async removeFeed(id: string): Promise<void> {
    await db.remove('feeds', id);
    for (const a of this.articles().filter((x) => x.feedId === id)) await db.remove('articles', a.id);
    this.feeds.update((l) => l.filter((f) => f.id !== id));
    this.articles.update((l) => l.filter((a) => a.feedId !== id));
    const s = this.scope();
    if (s.type === 'feed' && s.id === id) this.scope.set({ type: 'all' });
  }

  async setFeedCategory(feedId: string, categoryId: string | null): Promise<void> {
    const feed = this.feeds().find((f) => f.id === feedId);
    if (!feed) return;
    const updated = { ...feed, categoryId };
    await db.put('feeds', updated);
    this.feeds.update((l) => l.map((f) => (f.id === feedId ? updated : f)));
  }

  async addCategory(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || this.categories().some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return;
    const category = { id: `c${Date.now().toString(36)}`, name: trimmed };
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

  async refreshAll(): Promise<void> {
    if (this.syncing() || !navigator.onLine) return;
    this.syncing.set(true);
    try {
      await Promise.all(this.feeds().map((f) => this.refreshFeed(f)));
    } finally {
      this.lastRefresh = Date.now();
      this.syncing.set(false);
    }
  }

  async patch(id: string, changes: Partial<Pick<Article, 'read' | 'favorite'>>): Promise<void> {
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

  private async refreshFeed(feed: Feed): Promise<void> {
    let updated: Feed;
    try {
      const parsed = parseFeed(await this.download(feed.url), feed.id);
      await this.merge(feed.id, parsed.items);
      updated = { ...feed, lastFetched: Date.now(), error: undefined };
    } catch (error) {
      updated = { ...feed, error: error instanceof Error ? error.message : 'Erreur' };
    }
    await db.put('feeds', updated);
    this.feeds.update((l) => l.map((f) => (f.id === feed.id ? updated : f)));
  }

  private async merge(feedId: string, items: Omit<Article, 'feedId' | 'read' | 'favorite'>[]): Promise<void> {
    const existing = new Set(this.articles().map((a) => a.id));
    const fresh: Article[] = items.filter((i) => !existing.has(i.id)).map((i) => ({ ...i, feedId, read: false, favorite: false }));
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

  private async download(url: string): Promise<string> {
    const proxy = this.proxyEnabled() ? proxyOrigin(this.proxy()) : '';
    let response: Response;
    if (proxy) {
      // budget-caldav-proxy contract: same path and query on the proxy, target origin in X-Upstream.
      const target = new URL(url);
      response = await fetch(proxy + target.pathname + target.search, { credentials: 'omit', headers: { 'X-Upstream': target.origin } });
    } else {
      response = await fetch(url);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }
}
