import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore } from './articles.store';
import { db } from '../storage/db';
import { FeedsStore } from './feeds.store';
import { Article, Feed } from '../models';
import { FetchService } from '../services/fetch.service';

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title><link>https://s.com</link>${items}</channel></rss>`;
const item = (n: number) =>
  `<item><title>T${n}</title><link>https://s.com/${n}</link><guid>g${n}</guid><pubDate>Mon, 06 Jan 2025 10:00:00 GMT</pubDate><description>S${n}</description></item>`;
const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: `https://s.com/${id}`, summary: '', content: '', published: Date.now(), read: false, favorite: false, ...over,
});
const feed = (id: string, over: Partial<Feed> = {}): Feed => ({ id, url: `https://${id}.com/rss`, title: id, categoryId: null, ...over });

describe('FeedsStore', () => {
  const download = vi.fn();
  let store: FeedsStore;
  let articles: ArticlesStore;

  beforeEach(async () => {
    for (const name of ['feeds', 'categories', 'articles'] as const) {
      for (const r of await db.all<{ id: string }>(name)) await db.remove(name, r.id);
    }
    localStorage.clear();
    TestBed.resetTestingModule();
    download.mockReset();
    download.mockRejectedValue(new Error('offline'));
    TestBed.configureTestingModule({ providers: [{ provide: FetchService, useValue: { download } }] });
    store = TestBed.inject(FeedsStore);
    articles = TestBed.inject(ArticlesStore);
  });

  it('loads feeds and categories', async () => {
    await db.put('feeds', feed('f1'));
    await db.put('categories', { id: 'c1', name: 'C' });
    await store.load();
    expect(store.feeds()).toHaveLength(1);
    expect(store.categories()).toHaveLength(1);
  });

  it('adds a feed from a direct feed url', async () => {
    download.mockResolvedValue(rss(item(1)));
    await store.addFeed(' https://s.com/rss ', null);
    expect(store.feeds()[0]).toMatchObject({ url: 'https://s.com/rss', title: 'Blog', format: 'RSS 2.0' });
    expect(articles.articles()).toHaveLength(1);
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

  it('updates an existing feed with putFeed and updateFeed', async () => {
    await store.putFeed(feed('a'));
    await store.putFeed(feed('a', { title: 'New' }));
    expect(store.feeds()).toHaveLength(1);
    expect(store.feeds()[0].title).toBe('New');
    await store.updateFeed(feed('a', { title: 'Newer' }));
    await store.updateFeed(feed('gone'));
    expect(store.feeds().map((f) => f.title)).toEqual(['Newer']);
  });

  it('removes a feed with a tombstone and its articles, and notifies', async () => {
    const removed = vi.fn();
    store.onRemoved(removed);
    await store.putFeed(feed('f1'));
    articles.articles.set([art('f1:a'), art('f2:b', { feedId: 'f2' })]);
    await db.putMany('articles', articles.articles());
    await store.removeFeed('f1');
    await store.removeFeed('unknown');
    expect(store.removedFeeds()).toEqual(['https://f1.com/rss']);
    expect(articles.articles().map((a) => a.id)).toEqual(['f2:b']);
    expect(removed).toHaveBeenCalledWith({ kind: 'feed', id: 'f1' });
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
    const removed = vi.fn();
    store.onRemoved(removed);
    expect(await store.categoryIdFor('  ')).toBeNull();
    expect(await store.categoryIdFor(null)).toBeNull();
    await store.addCategory('News');
    const id = await store.categoryIdFor('news');
    expect(store.categories()).toHaveLength(1);
    await store.putCategory({ id: id!, name: 'dup' });
    expect(store.categories()).toHaveLength(1);

    await store.putFeed(feed('f1', { categoryId: id }));
    await store.setFeedCategory('nope', null);
    await store.removeCategory(id!);
    expect(store.categories()).toEqual([]);
    expect(store.feeds()[0].categoryId).toBeNull();
    expect(removed).toHaveBeenCalledWith({ kind: 'category', id });
  });

  it('lists dead feeds', () => {
    store.feeds.set([feed('a', { failures: 5 }), feed('b', { failures: 4 }), feed('c')]);
    expect(store.deadFeeds().map((f) => f.id)).toEqual(['a']);
  });
});
