import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from './db';
import { parseFeed } from './feed-parser';
import { Article, Feed } from './models';
import { RssStore, flagsOf, stateKey } from './rss.store';
import { FetchService } from './services/fetch.service';
import { SettingsStore } from './settings.store';

const DAY = 86_400_000;
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title><link>https://s.com</link>${items}</channel></rss>`;
const item = (n: number, date = 'Mon, 06 Jan 2025 10:00:00 GMT') =>
  `<item><title>T${n}</title><link>https://s.com/${n}</link><guid>g${n}</guid><pubDate>${date}</pubDate><description>S${n}</description></item>`;

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: `https://s.com/${id}`, summary: '', content: '', published: Date.now(), read: false, favorite: false, ...over,
});
const feed = (id: string, over: Partial<Feed> = {}): Feed => ({ id, url: `https://${id}.com/rss`, title: id, categoryId: null, ...over });

describe('RssStore', () => {
  const download = vi.fn();
  let store: RssStore;
  let settings: SettingsStore;

  beforeEach(async () => {
    for (const name of ['feeds', 'categories', 'articles'] as const) {
      for (const r of await db.all<{ id: string }>(name)) await db.remove(name, r.id);
    }
    localStorage.clear();
    TestBed.resetTestingModule();
    download.mockReset();
    download.mockRejectedValue(new Error('offline'));
    TestBed.configureTestingModule({ providers: [{ provide: FetchService, useValue: { download } }] });
    settings = TestBed.inject(SettingsStore);
    settings.autoRefresh.set(0);
    store = TestBed.inject(RssStore);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('helpers', () => {
    it('derives state keys and flags', () => {
      expect(stateKey('f1:abc:d')).toBe('abc:d');
      expect(flagsOf({ read: true, favorite: true, later: true })).toBe(7);
      expect(flagsOf({ read: false, favorite: false })).toBe(0);
    });
  });

  describe('load', () => {
    it('loads from IndexedDB once and refreshes when online', async () => {
      await db.put('feeds', feed('f1'));
      await db.put('categories', { id: 'c1', name: 'C' });
      await db.put('articles', art('f1:a'));
      download.mockResolvedValue(rss(item(1)));
      await store.load();
      await store.load();
      expect(store.feeds()).toHaveLength(1);
      expect(store.categories()).toHaveLength(1);
      expect(store.article('f1:a')).toBeDefined();
      expect(store.article('nope')).toBeUndefined();
      await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    });

    it('does not refresh when offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      await store.load();
      expect(download).not.toHaveBeenCalled();
      await store.refreshAll();
      expect(download).not.toHaveBeenCalled();
    });
  });

  describe('feeds and categories', () => {
    it('adds a feed from a direct feed url', async () => {
      download.mockResolvedValue(rss(item(1)));
      await store.addFeed(' https://s.com/rss ', null);
      expect(store.feeds()[0]).toMatchObject({ url: 'https://s.com/rss', title: 'Blog', format: 'RSS 2.0' });
      expect(store.articles()).toHaveLength(1);
      await expect(store.addFeed('https://s.com/rss', null)).rejects.toThrow();
    });

    it('discovers the feed advertised by a page', async () => {
      download
        .mockResolvedValueOnce('<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head></html>')
        .mockResolvedValueOnce(rss(''));
      await store.addFeed('https://s.com', null);
      expect(store.feeds()[0].url).toBe('https://s.com/feed.xml');
      download.mockResolvedValueOnce('<html><body>nothing</body></html>');
      await expect(store.addFeed('https://other.com', null)).rejects.toThrow();
    });

    it('falls back to the hostname for untitled feeds', async () => {
      download.mockResolvedValue('<rss version="2.0"><channel></channel></rss>');
      await store.addFeed('https://untitled.com/rss', null);
      expect(store.feeds()[0].title).toBe('untitled.com');
    });

    it('updates an existing feed with putFeed', async () => {
      await store.putFeed(feed('a'));
      await store.putFeed(feed('a', { title: 'New' }));
      expect(store.feeds()).toHaveLength(1);
      expect(store.feeds()[0].title).toBe('New');
    });

    it('removes a feed with a tombstone, its articles and scope', async () => {
      await store.putFeed(feed('f1'));
      store.articles.set([art('f1:a'), art('f2:b', { feedId: 'f2' })]);
      await db.putMany('articles', store.articles());
      store.scope.set({ type: 'feed', id: 'f1' });
      await store.removeFeed('f1');
      await store.removeFeed('unknown');
      expect(store.removedFeeds()).toEqual(['https://f1.com/rss']);
      expect(store.articles().map((a) => a.id)).toEqual(['f2:b']);
      expect(store.scope()).toEqual({ type: 'all' });
    });

    it('keeps the scope when dropping another feed', async () => {
      await store.putFeed(feed('f1'));
      store.scope.set({ type: 'favorites' });
      await store.dropFeed('f1');
      expect(store.scope()).toEqual({ type: 'favorites' });
    });

    it('tracks re-followed feeds', () => {
      store.noteFollowed('https://x.com');
      expect(store.wasReadded('https://x.com')).toBe(false);
      store.removedFeeds.set(['https://x.com']);
      store.noteFollowed('https://x.com');
      expect(store.removedFeeds()).toEqual([]);
      expect(store.wasReadded('https://x.com')).toBe(true);
      store.markSynced();
      expect(store.wasReadded('https://x.com')).toBe(false);
    });

    it('manages categories', async () => {
      expect(await store.categoryIdFor('  ')).toBeNull();
      expect(await store.categoryIdFor(null)).toBeNull();
      await store.addCategory('News');
      const id = await store.categoryIdFor('news');
      expect(store.categories()).toHaveLength(1);
      await store.putCategory({ id: id!, name: 'dup' });
      expect(store.categories()).toHaveLength(1);

      await store.putFeed(feed('f1', { categoryId: id }));
      await store.setFeedCategory('nope', null);
      store.scope.set({ type: 'category', id: id! });
      await store.removeCategory(id!);
      expect(store.categories()).toEqual([]);
      expect(store.feeds()[0].categoryId).toBeNull();
      expect(store.scope()).toEqual({ type: 'all' });
      await store.removeCategory('other');
    });

    it('generates distinct feed ids', () => {
      expect(store.newFeedId()).toMatch(/^f/);
    });
  });

  describe('views', () => {
    beforeEach(() => {
      const old = Date.now() - 3 * DAY;
      store.feeds.set([feed('f1', { categoryId: 'c1', title: 'B' }), feed('f2', { title: 'A' }), feed('f3', { categoryId: 'c1', title: 'C' })]);
      store.categories.set([{ id: 'c1', name: 'Cat' }, { id: 'c2', name: 'Empty' }]);
      store.articles.set([
        art('f1:a', { published: old, content: '<p>Hello World</p>' }),
        art('f1:b', { read: true }),
        art('f2:c', { feedId: 'f2', favorite: true, read: true, title: 'Muted thing' }),
        art('f3:d', { feedId: 'f3', later: true, read: true }),
        art('f2:e', { feedId: 'f2', title: 'Muted stuff' }),
      ]);
    });

    it('titles scopes', () => {
      expect(store.scopeTitle()).toBe('Tous les flux');
      store.scope.set({ type: 'feed', id: 'f1' });
      expect(store.scopeTitle()).toBe('B');
      store.scope.set({ type: 'feed', id: 'zz' });
      expect(store.scopeTitle()).toBe('');
      store.scope.set({ type: 'category', id: 'c1' });
      expect(store.scopeTitle()).toBe('Cat');
      store.scope.set({ type: 'category', id: 'zz' });
      expect(store.scopeTitle()).toBe('');
      store.scope.set({ type: 'today' });
      expect(store.scopeTitle()).toBe("Aujourd'hui");
      store.scope.set({ type: 'favorites' });
      expect(store.scopeTitle()).toBe('Favoris');
      store.scope.set({ type: 'later' });
      expect(store.scopeTitle()).not.toBe('');
    });

    it('filters by scope and read state', () => {
      const ids = () => store.visible().map((a) => a.id);
      expect(ids()).toEqual(['f2:e', 'f1:a']);
      store.unreadOnly.set(false);
      expect(ids()).toHaveLength(5);
      store.scope.set({ type: 'feed', id: 'f2' });
      expect(ids().sort()).toEqual(['f2:c', 'f2:e']);
      store.scope.set({ type: 'category', id: 'c1' });
      expect(ids().sort()).toEqual(['f1:a', 'f1:b', 'f3:d']);
      store.scope.set({ type: 'today' });
      expect(ids().sort()).not.toContain('f1:a');
      store.scope.set({ type: 'favorites' });
      expect(ids()).toEqual(['f2:c']);
      store.unreadOnly.set(true);
      expect(ids()).toEqual(['f2:c']);
      store.scope.set({ type: 'later' });
      expect(ids()).toEqual(['f3:d']);
    });

    it('applies muted words (except favorites/later) and search', () => {
      settings.setMutedWords(['muted']);
      expect(store.visible().map((a) => a.id)).toEqual(['f1:a']);
      store.unreadOnly.set(false);
      expect(store.visible().map((a) => a.id)).toContain('f2:c');
      settings.setMutedWords([]);
      store.search.set(' hello ');
      expect(store.visible().map((a) => a.id)).toEqual(['f1:a']);
    });

    it('computes counters and groups', () => {
      expect(store.unreadTotal()).toBe(2);
      expect(store.unreadToday()).toBe(1);
      expect(store.favoriteCount()).toBe(1);
      expect(store.laterCount()).toBe(1);
      expect(store.unreadByFeed().get('f1')).toBe(1);
      expect(store.groups().map((g) => g.name)).toEqual(['Cat', 'Autres']);
      expect(store.groups()[0].unread).toBe(1);
      store.unreadOnly.set(false);
      expect(store.groups().map((g) => g.name)).toEqual(['Cat', 'Empty', 'Autres']);
      store.feeds.update((l) => l.map((f) => (f.id === 'f1' ? { ...f, failures: 5 } : f)));
      expect(store.deadFeeds().map((f) => f.id)).toEqual(['f1']);
      store.feeds.update((l) => l.filter((f) => f.categoryId));
      expect(store.groups().map((g) => g.name)).not.toContain('Autres');
    });
  });

  describe('articles', () => {
    it('patches and marks everything visible as read', async () => {
      store.articles.set([art('f1:a'), art('f1:b'), art('f1:c', { read: true })]);
      await store.patch('nope', { read: true });
      await store.patch('f1:a', { favorite: true });
      expect(store.article('f1:a')?.favorite).toBe(true);
      await store.markAllRead();
      expect(store.articles().every((a) => a.read)).toBe(true);
      expect((await db.all<Article>('articles')).filter((a) => a.read)).toHaveLength(2);
    });

    it('merges flags into current and future articles', async () => {
      store.articles.set([art('f1:a'), art('f1:b', { read: true })]);
      await store.applyFlags({ b: 1 });
      download.mockResolvedValue(rss(item(1)));
      const key = stateKey(parseFeed(rss(item(1)), 'f9').items[0].id);
      await store.applyFlags({ a: 3, [key]: 6 });
      expect(store.article('f1:a')).toMatchObject({ read: true, favorite: true });
      expect(store.article('f1:b')?.read).toBe(true);
      await store.putFeed(feed('f9', { url: 'https://f9.com/rss' }));
      await store.refreshAll();
      const merged = store.articles().find((a) => a.feedId === 'f9');
      expect(merged).toMatchObject({ favorite: true, later: true, read: false });
    });

    it('fetches full text', async () => {
      store.articles.set([art('f1:a'), art('f1:nolink', { link: '' })]);
      await expect(store.fetchFullText('missing')).rejects.toThrow();
      await expect(store.fetchFullText('f1:nolink')).rejects.toThrow();
      download.mockResolvedValueOnce('<html><body><article><p>short</p></article></body></html>');
      await expect(store.fetchFullText('f1:a')).rejects.toThrow('Texte complet introuvable');
      download.mockResolvedValueOnce(`<html><body><article><p>${'word '.repeat(80)}</p></article></body></html>`);
      await store.fetchFullText('f1:a');
      expect(store.article('f1:a')?.fullText).toBe(true);
    });
  });

  describe('refresh and purge', () => {
    it('records success and failure per feed', async () => {
      store.feeds.set([feed('ok', { url: 'https://ok.com/rss', failures: 2, error: 'x' }), feed('ko', { url: 'https://ko.com/rss' }), feed('ko2', { url: 'https://ko2.com/rss' })]);
      download.mockImplementation(async (url: string) => {
        if (url.includes('ko2')) throw 'weird';
        if (url.includes('ko')) throw new Error('boom');
        return rss(item(1));
      });
      const second = store.refreshAll();
      await store.refreshAll();
      await second;
      const by = (id: string) => store.feeds().find((f) => f.id === id)!;
      expect(by('ok')).toMatchObject({ failures: 0, siteUrl: 'https://s.com' });
      expect(by('ko')).toMatchObject({ failures: 1, error: 'boom' });
      expect(by('ko2')).toMatchObject({ error: 'Erreur' });
      expect(store.syncing()).toBe(false);
    });

    it('caps articles per feed but keeps favourites', async () => {
      const many = Array.from({ length: 105 }, (_, i) => item(i, new Date(Date.UTC(2025, 0, 1, 0, i)).toUTCString())).join('');
      download.mockResolvedValue(rss(many));
      await store.putFeed(feed('f1', { url: 'https://s.com/rss' }));
      await store.refreshAll();
      expect(store.articles()).toHaveLength(100);
      await store.refreshAll();
      expect(store.articles()).toHaveLength(100);
    });

    it('purges old read articles according to retention', async () => {
      const old = Date.now() - 10 * DAY;
      store.articles.set([art('f1:a', { read: true, published: old }), art('f1:b', { read: true, published: old, favorite: true }), art('f1:c', { published: old })]);
      await store.purge();
      expect(store.articles()).toHaveLength(3);
      settings.retentionDays.set(5);
      await store.purge();
      expect(store.articles().map((a) => a.id)).toEqual(['f1:b', 'f1:c']);
      await store.purge();
      TestBed.tick();
    });
  });

  describe('automatic refresh', () => {
    it('refreshes on online event, when visible and when due', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      await store.load();
      const refresh = vi.spyOn(store, 'refreshAll').mockResolvedValue();
      window.dispatchEvent(new Event('online'));
      expect(store.online()).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('offline'));
      expect(store.online()).toBe(false);

      settings.autoRefresh.set(1);
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(61_000);
      expect(refresh).toHaveBeenCalledTimes(2);
      settings.autoRefresh.set(2);
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(31_000);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(refresh).toHaveBeenCalledTimes(2);
      settings.autoRefresh.set(0);
      TestBed.tick();
      document.dispatchEvent(new Event('visibilitychange'));
      expect(refresh).toHaveBeenCalledTimes(2);
    });

    it('does nothing before load or while hidden', () => {
      const refresh = vi.spyOn(store, 'refreshAll').mockResolvedValue();
      settings.autoRefresh.set(1);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
