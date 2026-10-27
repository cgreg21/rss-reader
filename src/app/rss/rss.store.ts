import { Injectable, computed, signal } from '@angular/core';

import { db } from './db';
import { deduceFeedUrl, discoverFeedUrl, extractReadable, looksLikeHtml, parseFeed } from './feed-parser';
import { Article, Category, Feed, ParsedFeed } from './models';
import { buildOpml, parseOpml } from './opml';

const toPlainLength = (html: string): number => html.replace(/<[^>]*>/g, '').trim().length;

export type Scope =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'favorites' }
  | { type: 'later' }
  | { type: 'feed'; id: string }
  | { type: 'category'; id: string };

const PROXY_KEY = 'rssreader:caldav-proxy';
const PROXY_ENABLED_KEY = 'rssreader:proxy-enabled';
const AUTO_REFRESH_KEY = 'rssreader:auto-refresh';
const MUTED_KEY = 'rssreader:muted-words';
const RETENTION_KEY = 'rssreader:retention-days';
const FONT_KEY = 'rssreader:font-size';
const THEME_KEY = 'rssreader:theme';
const DEFAULT_PROXY = '';
const MAX_CACHED_IMAGES = 300;
const DEAD_FEED_FAILURES = 5;
const REMOVED_KEY = 'rssreader:removed-feeds';

/** Cross-device synchronised library: article states are keyed by the feed-independent part of the article id. */
export interface SyncDoc {
  feeds: { url: string; title: string; category: string | null }[];
  removed: string[];
  /** Bit flags per article: 1 read, 2 favorite, 4 later. */
  states: Record<string, number>;
}
const stateKey = (articleId: string): string => articleId.slice(articleId.indexOf(':') + 1);
const flags = (a: Article): number => (a.read ? 1 : 0) | (a.favorite ? 2 : 0) | (a.later ? 4 : 0);

export type Theme = 'dark' | 'light';
const applyAppearance = (theme: Theme, fontSize: number): void => {
  document.documentElement.dataset['theme'] = theme;
  document.documentElement.style.setProperty('--body-size', `${fontSize}px`);
};

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

export interface FeedHit {
  url: string;
  title: string;
  website?: string;
  description?: string;
  subscribers?: number;
}

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
  /** One muted word or phrase per entry; matching articles are hidden. */
  readonly mutedWords = signal<string[]>(JSON.parse(localStorage.getItem(MUTED_KEY) ?? '[]') as string[]);
  /** Read, non-favorite articles older than this many days are purged; 0 keeps everything. */
  readonly retentionDays = signal(Number(localStorage.getItem(RETENTION_KEY) ?? 0) || 0);
  readonly fontSize = signal(Number(localStorage.getItem(FONT_KEY) ?? 17) || 17);
  readonly theme = signal<Theme>(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');

  setMutedWords(words: string[]): void {
    const clean = words.map((w) => w.trim().toLowerCase()).filter(Boolean);
    this.mutedWords.set(clean);
    localStorage.setItem(MUTED_KEY, JSON.stringify(clean));
  }

  setRetentionDays(days: number): void {
    this.retentionDays.set(days);
    localStorage.setItem(RETENTION_KEY, String(days));
    void this.purge();
  }

  setFontSize(size: number): void {
    this.fontSize.set(size);
    localStorage.setItem(FONT_KEY, String(size));
    applyAppearance(this.theme(), size);
  }

  setTheme(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(THEME_KEY, theme);
    applyAppearance(theme, this.fontSize());
  }

  setLayout(value: ArticleLayout): void {
    this.layout.set(value);
    localStorage.setItem(LAYOUT_KEY, value);
  }

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
    const muted = this.mutedWords();
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

  constructor() {
    applyAppearance(this.theme(), this.fontSize());
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
    let url = deduceFeedUrl(rawUrl.trim()) ?? new URL(rawUrl.trim()).href;
    let body = await this.download(url);
    if (looksLikeHtml(body)) {
      const discovered = discoverFeedUrl(body, url);
      if (!discovered) throw new Error('Aucun flux trouvé sur cette page');
      url = discovered;
      body = await this.download(url);
    }
    if (this.feeds().some((f) => f.url === url)) throw new Error('Flux déjà suivi');
    this.noteFollowed(url);
    const id = `f${Date.now().toString(36)}`;
    const parsed = parseFeed(body, id);
    const feed: Feed = { id, url, title: parsed.title || new URL(url).hostname, siteUrl: parsed.siteUrl, description: parsed.description, format: parsed.format, categoryId, lastFetched: Date.now() };
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
      this.noteFollowed(url);
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
    const url = this.feeds().find((f) => f.id === id)?.url;
    if (url) this.setRemovedFeeds([...new Set([...this.removedFeeds(), url])]);
    await this.removeFeedLocal(id);
  }

  /** Urls of feeds unfollowed on some device, kept so synchronisation can propagate the removal. */
  readonly removedFeeds = signal<string[]>(JSON.parse(localStorage.getItem(REMOVED_KEY) ?? '[]') as string[]);
  /** Feeds re-followed here since the last sync, which must not be removed again by an older remote tombstone. */
  private readonly readded = new Set<string>();

  setRemovedFeeds(urls: string[]): void {
    this.removedFeeds.set(urls);
    localStorage.setItem(REMOVED_KEY, JSON.stringify(urls));
  }

  markSynced(): void {
    this.readded.clear();
  }

  private noteFollowed(url: string): void {
    if (!this.removedFeeds().includes(url)) return;
    this.readded.add(url);
    this.setRemovedFeeds(this.removedFeeds().filter((u) => u !== url));
  }

  private async removeFeedLocal(id: string): Promise<void> {
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
    await this.purge();
  }

  async purge(): Promise<void> {
    const days = this.retentionDays();
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

  private async refreshFeed(feed: Feed): Promise<void> {
    let updated: Feed;
    try {
      const parsed = parseFeed(await this.download(feed.url), feed.id);
      await this.merge(feed.id, parsed.items);
      updated = { ...feed, siteUrl: feed.siteUrl ?? parsed.siteUrl, description: parsed.description ?? feed.description, format: parsed.format, lastFetched: Date.now(), error: undefined, failures: 0 };
    } catch (error) {
      updated = { ...feed, error: error instanceof Error ? error.message : 'Erreur', failures: (feed.failures ?? 0) + 1 };
    }
    await db.put('feeds', updated);
    this.feeds.update((l) => l.map((f) => (f.id === feed.id ? updated : f)));
  }

  /** Downloads the article's web page and replaces its content with the extracted full text. */
  async fetchFullText(id: string): Promise<void> {
    const article = this.article(id);
    if (!article?.link) throw new Error("Pas d'adresse d'origine");
    const content = extractReadable(await this.download(article.link), article.link);
    if (toPlainLength(content) < 200) throw new Error('Texte complet introuvable');
    const updated = { ...article, content, fullText: true };
    this.articles.update((l) => l.map((a) => (a.id === id ? updated : a)));
    await db.put('articles', updated);
  }

  /** Feeds, categories and article states as JSON, to move the library to another device. */
  exportBackup(): string {
    const states = this.articles().filter((a) => a.read || a.favorite || a.later).map((a) => ({ id: a.id, read: a.read, favorite: a.favorite, later: !!a.later }));
    return JSON.stringify({ version: 1, categories: this.categories(), feeds: this.feeds().map(({ error, failures, ...f }) => f), states });
  }

  async importBackup(json: string): Promise<{ feeds: number }> {
    const data = JSON.parse(json) as { categories?: Category[]; feeds?: Feed[]; states?: { id: string; read: boolean; favorite: boolean; later: boolean }[] };
    if (!Array.isArray(data.feeds)) throw new Error('Sauvegarde invalide');
    for (const c of data.categories ?? []) {
      if (this.categories().some((x) => x.id === c.id)) continue;
      await db.put('categories', c);
      this.categories.update((l) => [...l, c]);
    }
    const known = new Set(this.feeds().map((f) => f.url));
    let feeds = 0;
    for (const f of data.feeds) {
      if (known.has(f.url)) continue;
      await db.put('feeds', f);
      this.feeds.update((l) => [...l, f]);
      feeds++;
    }
    this.pendingStates = new Map((data.states ?? []).map((s) => [s.id, s]));
    await this.refreshAll();
    await this.applyPendingStates();
    return { feeds };
  }

  private pendingStates = new Map<string, { read: boolean; favorite: boolean; later: boolean }>();

  buildSyncDoc(): SyncDoc {
    const categories = new Map(this.categories().map((c) => [c.id, c.name]));
    const states: Record<string, number> = {};
    for (const a of this.articles()) if (flags(a)) states[stateKey(a.id)] = flags(a);
    return {
      feeds: this.feeds().map((f) => ({ url: f.url, title: f.title, category: f.categoryId ? categories.get(f.categoryId) ?? null : null })),
      removed: this.removedFeeds(),
      states,
    };
  }

  /** Merges a remote document into the local library: feeds and states are unions, removals win. */
  async applySyncDoc(doc: SyncDoc): Promise<void> {
    const removed = new Set([...this.removedFeeds(), ...(doc.removed ?? []).filter((u) => !this.readded.has(u))]);
    for (const f of this.feeds().filter((x) => removed.has(x.url))) await this.removeFeedLocal(f.id);
    this.setRemovedFeeds([...removed]);
    for (const remote of doc.feeds ?? []) {
      if (removed.has(remote.url) || this.feeds().some((f) => f.url === remote.url)) continue;
      let categoryId: string | null = null;
      if (remote.category) {
        await this.addCategory(remote.category);
        categoryId = this.categories().find((c) => c.name.toLowerCase() === remote.category!.toLowerCase())?.id ?? null;
      }
      const feed: Feed = { id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, url: remote.url, title: remote.title, categoryId };
      await db.put('feeds', feed);
      this.feeds.update((l) => [...l, feed]);
    }
    const changed: Article[] = [];
    const next = this.articles().map((a) => {
      const remote = doc.states?.[stateKey(a.id)] ?? 0;
      const merged = flags(a) | remote;
      if (merged === flags(a)) return a;
      const updated = { ...a, read: !!(merged & 1), favorite: !!(merged & 2), later: !!(merged & 4) };
      changed.push(updated);
      return updated;
    });
    if (changed.length) {
      this.articles.set(next);
      await db.putMany('articles', changed);
    }
    this.remoteStates = doc.states ?? {};
  }

  /** Remote states for articles not downloaded yet, applied once they arrive. */
  private remoteStates: Record<string, number> = {};

  private async applyPendingStates(): Promise<void> {
    const changed = this.articles().filter((a) => this.pendingStates.has(a.id)).map((a) => ({ ...a, ...this.pendingStates.get(a.id)! }));
    this.pendingStates.clear();
    if (!changed.length) return;
    const byId = new Map(changed.map((a) => [a.id, a]));
    this.articles.update((l) => l.map((a) => byId.get(a.id) ?? a));
    await db.putMany('articles', changed);
  }

  private async merge(feedId: string, items: ParsedFeed['items']): Promise<void> {
    const existing = new Set(this.articles().map((a) => a.id));
    const fresh: Article[] = items.filter((i) => !existing.has(i.id)).map((i) => {
      const remote = this.remoteStates[stateKey(i.id)] ?? 0;
      return { ...i, feedId, read: !!(remote & 1), favorite: !!(remote & 2), later: !!(remote & 4) };
    });
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

  /** Searches feeds online (Feedly public directory); also accepts a site URL. */
  async searchFeeds(query: string): Promise<FeedHit[]> {
    const text = await this.download(`https://cloud.feedly.com/v3/search/feeds?count=20&query=${encodeURIComponent(query.trim())}`);
    const data = JSON.parse(text) as { results?: { feedId: string; title?: string; website?: string; description?: string; subscribers?: number }[] };
    return (data.results ?? [])
      .filter((r) => r.feedId?.startsWith('feed/'))
      .map((r) => ({ url: r.feedId.slice(5), title: r.title ?? r.feedId.slice(5), website: r.website, description: r.description, subscribers: r.subscribers }));
  }

  private async request(url: string): Promise<Response> {
    const proxy = this.proxyEnabled() ? proxyOrigin(this.proxy()) : '';
    if (!proxy) return fetch(url);
    // budget-caldav-proxy contract: same path and query on the proxy, target origin in X-Upstream.
    const target = new URL(url);
    return fetch(proxy + target.pathname + target.search, { credentials: 'omit', headers: { 'X-Upstream': target.origin } });
  }

  private async download(url: string): Promise<string> {
    const response = await this.request(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  private readonly images = new Map<string, Promise<string>>();
  private static readonly IMAGE_CACHE = 'rss-images';
  readonly imageCacheCount = signal(0);

  /** URL to display for an image: fetched through the proxy as a blob when enabled (persisted in the Cache API), else the original URL. */
  imageUrl(url: string): Promise<string> {
    const proxied = this.proxyEnabled() && proxyOrigin(this.proxy()) !== '' && /^https?:/i.test(url);
    if (!proxied) return Promise.resolve(url);
    let blob = this.images.get(url);
    if (!blob) {
      blob = this.cachedImage(url)
        .catch(() => {
          this.images.delete(url);
          return url;
        });
      this.images.set(url, blob);
    }
    return blob;
  }

  private async cachedImage(url: string): Promise<string> {
    const cache = 'caches' in globalThis ? await caches.open(RssStore.IMAGE_CACHE) : null;
    let response = (await cache?.match(url)) ?? null;
    if (!response) {
      response = await this.request(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (cache) {
        await cache.put(url, response.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_IMAGES))) await cache.delete(old);
        void this.refreshImageCacheCount();
      }
    }
    return URL.createObjectURL(await response.blob());
  }

  async refreshImageCacheCount(): Promise<void> {
    this.imageCacheCount.set('caches' in globalThis ? (await (await caches.open(RssStore.IMAGE_CACHE)).keys()).length : 0);
  }

  async clearImageCache(): Promise<void> {
    for (const blob of this.images.values()) void blob.then((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    this.images.clear();
    if ('caches' in globalThis) await caches.delete(RssStore.IMAGE_CACHE);
    this.imageCacheCount.set(0);
  }
}
