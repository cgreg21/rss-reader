import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore, stateKey } from '../articles.store';
import { db } from '../db';
import { FeedsStore } from '../feeds.store';
import { parseFeed } from '../feed-parser';
import { Article, Feed } from '../models';
import { SettingsStore } from '../settings.store';
import { FetchService } from './fetch.service';
import { RefreshService } from './refresh.service';

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title><link>https://s.com</link>${items}</channel></rss>`;
const item = (n: number, date = 'Mon, 06 Jan 2025 10:00:00 GMT') =>
  `<item><title>T${n}</title><link>https://s.com/${n}</link><guid>g${n}</guid><pubDate>${date}</pubDate><description>S${n}</description></item>`;
const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: `https://s.com/${id}`, summary: '', content: '', published: Date.now(), read: false, favorite: false, ...over,
});
const feed = (id: string, over: Partial<Feed> = {}): Feed => ({ id, url: `https://${id}.com/rss`, title: id, categoryId: null, ...over });

describe('RefreshService', () => {
  const download = vi.fn();
  let service: RefreshService;
  let feeds: FeedsStore;
  let articles: ArticlesStore;
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
    feeds = TestBed.inject(FeedsStore);
    articles = TestBed.inject(ArticlesStore);
    service = TestBed.inject(RefreshService);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('load', () => {
    it('loads from IndexedDB once and refreshes when online', async () => {
      await db.put('feeds', feed('f1'));
      await db.put('categories', { id: 'c1', name: 'C' });
      await db.put('articles', art('f1:a'));
      download.mockResolvedValue(rss(item(1)));
      await service.load();
      await service.load();
      expect(feeds.feeds()).toHaveLength(1);
      expect(feeds.categories()).toHaveLength(1);
      expect(articles.article('f1:a')).toBeDefined();
      await vi.waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    });

    it('does not refresh when offline', async () => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      await service.load();
      expect(download).not.toHaveBeenCalled();
      await service.refreshAll();
      expect(download).not.toHaveBeenCalled();
    });
  });

  describe('refreshAll', () => {
    it('records success and failure per feed', async () => {
      feeds.feeds.set([feed('ok', { url: 'https://ok.com/rss', failures: 2, error: 'x' }), feed('ko', { url: 'https://ko.com/rss' }), feed('ko2', { url: 'https://ko2.com/rss' })]);
      download.mockImplementation(async (url: string) => {
        if (url.includes('ko2')) throw 'weird';
        if (url.includes('ko')) throw new Error('boom');
        return rss(item(1));
      });
      const second = service.refreshAll();
      await service.refreshAll();
      await second;
      const by = (id: string) => feeds.feeds().find((f) => f.id === id)!;
      expect(by('ok')).toMatchObject({ failures: 0, siteUrl: 'https://s.com' });
      expect(by('ko')).toMatchObject({ failures: 1, error: 'boom' });
      expect(by('ko2')).toMatchObject({ error: 'Erreur' });
      expect(service.syncing()).toBe(false);
    });

    it('keeps refreshing the other feeds when saving one fails', async () => {
      feeds.feeds.set([feed('a', { url: 'https://a.com/rss' }), feed('b', { url: 'https://b.com/rss' })]);
      download.mockResolvedValue(rss(item(1)));
      const update = feeds.updateFeed.bind(feeds);
      vi.spyOn(feeds, 'updateFeed').mockImplementation((f) => (f.id === 'a' ? Promise.reject(new Error('db')) : update(f)));
      await service.refreshAll();
      expect(feeds.feeds().find((f) => f.id === 'b')?.failures).toBe(0);
      expect(service.syncing()).toBe(false);
    });

    it('applies known flags to downloaded articles and caps them per feed', async () => {
      const key = stateKey(parseFeed(rss(item(1)), 'f9').items[0].id);
      await articles.applyFlags({ [key]: 6 });
      download.mockResolvedValue(rss(item(1)));
      await feeds.putFeed(feed('f9', { url: 'https://f9.com/rss' }));
      await service.refreshAll();
      expect(articles.articles().find((a) => a.feedId === 'f9')).toMatchObject({ favorite: true, later: true, read: false });
    });

    it('purges after refreshing', async () => {
      const purge = vi.spyOn(articles, 'purge');
      await service.refreshAll();
      expect(purge).toHaveBeenCalled();
    });
  });

  describe('automatic refresh', () => {
    it('refreshes on online event, when visible and when due', async () => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      await service.load();
      const refresh = vi.spyOn(service, 'refreshAll').mockResolvedValue();
      window.dispatchEvent(new Event('online'));
      expect(service.online()).toBe(true);
      expect(refresh).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('offline'));
      expect(service.online()).toBe(false);

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
      const refresh = vi.spyOn(service, 'refreshAll').mockResolvedValue();
      settings.autoRefresh.set(1);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
