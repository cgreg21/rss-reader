import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore, flagsOf, stateKey } from './articles.store';
import { db } from '../storage/db';
import { parseFeed } from '../parsing/feed-parser';
import { Article } from '../models';
import { FetchService } from '../services/fetch.service';
import { SettingsStore } from './settings.store';
import { SnackbarService } from '../../ui/snackbar/snackbar.service';

const DAY = 86_400_000;
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog</title><link>https://s.com</link>${items}</channel></rss>`;
const item = (n: number, date = 'Mon, 06 Jan 2025 10:00:00 GMT') =>
  `<item><title>T${n}</title><link>https://s.com/${n}</link><guid>g${n}</guid><pubDate>${date}</pubDate><description>S${n}</description></item>`;
const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: `https://s.com/${id}`, summary: '', content: '', published: Date.now(), read: false, favorite: false, ...over,
});

describe('ArticlesStore', () => {
  const download = vi.fn();
  const snackbar = { show: vi.fn() };
  let store: ArticlesStore;
  let settings: SettingsStore;

  beforeEach(async () => {
    for (const r of await db.all<{ id: string }>('articles')) await db.remove('articles', r.id);
    localStorage.clear();
    TestBed.resetTestingModule();
    download.mockReset();
    snackbar.show.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: FetchService, useValue: { download } }, { provide: SnackbarService, useValue: snackbar }] });
    settings = TestBed.inject(SettingsStore);
    store = TestBed.inject(ArticlesStore);
  });

  it('derives state keys and flags', () => {
    expect(stateKey('f1:abc:d')).toBe('abc:d');
    expect(flagsOf({ read: true, favorite: true, later: true })).toBe(7);
    expect(flagsOf({ read: false, favorite: false })).toBe(0);
  });

  it('loads from IndexedDB and finds articles', async () => {
    await db.put('articles', art('f1:a'));
    await store.load();
    expect(store.article('f1:a')).toBeDefined();
    expect(store.article('nope')).toBeUndefined();
  });

  it('computes counters', () => {
    const old = Date.now() - 3 * DAY;
    store.articles.set([
      art('f1:a', { published: old }),
      art('f1:b', { read: true }),
      art('f2:c', { feedId: 'f2', favorite: true, read: true }),
      art('f3:d', { feedId: 'f3', later: true, read: true }),
      art('f2:e', { feedId: 'f2' }),
    ]);
    expect(store.unreadTotal()).toBe(2);
    expect(store.unreadToday()).toBe(1);
    expect(store.favoriteCount()).toBe(1);
    expect(store.laterCount()).toBe(1);
    expect(store.unreadByFeed().get('f1')).toBe(1);
  });

  it('patches an article, ignoring unknown ids', async () => {
    store.articles.set([art('f1:a')]);
    await store.patch('nope', { read: true });
    await store.patch('f1:a', { favorite: true });
    expect(store.article('f1:a')?.favorite).toBe(true);
    expect((await db.all<Article>('articles')).find((a) => a.id === 'f1:a')?.favorite).toBe(true);
  });

  it('toggles a flag with a message', async () => {
    store.articles.set([art('f1:a')]);
    store.toggle(store.article('f1:a')!, 'read');
    expect(snackbar.show).toHaveBeenLastCalledWith('Marqué comme lu');
    store.toggle({ ...store.article('f1:a')!, read: true }, 'read');
    expect(snackbar.show).toHaveBeenLastCalledWith('Marqué comme non lu');
    store.toggle(art('f1:a'), 'favorite');
    expect(snackbar.show).toHaveBeenLastCalledWith('Ajouté aux favoris');
    store.toggle(art('f1:a', { favorite: true }), 'favorite');
    expect(snackbar.show).toHaveBeenLastCalledWith('Retiré des favoris');
    store.toggle(art('f1:a'), 'later');
    expect(snackbar.show).toHaveBeenLastCalledWith('Ajouté à À lire plus tard');
    store.toggle(art('f1:a', { later: true }), 'later');
    expect(snackbar.show).toHaveBeenLastCalledWith('Retiré de À lire plus tard');
    await vi.waitFor(async () => expect((await db.all<Article>('articles'))[0]?.later).toBe(false));
  });

  it('marks the given articles as read', async () => {
    store.articles.set([art('f1:a'), art('f1:b'), art('f1:c', { read: true })]);
    await db.putMany('articles', store.articles());
    await store.markRead(['f1:a', 'f1:c']);
    expect(store.articles().map((a) => a.read)).toEqual([true, false, true]);
    expect((await db.all<Article>('articles')).filter((a) => a.read)).toHaveLength(2);
  });

  it('merges flags into current and future articles', async () => {
    store.articles.set([art('f1:a'), art('f1:b', { read: true })]);
    await store.applyFlags({ b: 1 });
    const key = stateKey(parseFeed(rss(item(1)), 'f9').items[0].id);
    await store.applyFlags({ a: 3, [key]: 6 });
    expect(store.article('f1:a')).toMatchObject({ read: true, favorite: true });
    expect(store.article('f1:b')?.read).toBe(true);
    await store.merge('f9', parseFeed(rss(item(1)), 'f9').items);
    expect(store.articles().find((a) => a.feedId === 'f9')).toMatchObject({ favorite: true, later: true, read: false });
  });

  it('fetches full text', async () => {
    store.articles.set([art('f1:a'), art('f1:nolink', { link: '' })]);
    await expect(store.fetchFullText('missing')).rejects.toThrow();
    await expect(store.fetchFullText('f1:nolink')).rejects.toThrow();
    download.mockResolvedValueOnce('<html><body><article><p>short</p></article></body></html>');
    await expect(store.fetchFullText('f1:a')).rejects.toThrow('err.noFullText');
    download.mockResolvedValueOnce(`<html><body><article><p>${'word '.repeat(80)}</p></article></body></html>`);
    await store.fetchFullText('f1:a');
    expect(store.article('f1:a')?.fullText).toBe(true);
  });

  it('caps merged articles per feed but keeps favourites', async () => {
    const many = Array.from({ length: 105 }, (_, i) => item(i, new Date(Date.UTC(2025, 0, 1, 0, i)).toUTCString())).join('');
    const items = parseFeed(rss(many), 'f1').items;
    await store.merge('f1', []);
    await store.merge('f1', items);
    expect(store.articles()).toHaveLength(100);
    await store.merge('f1', items);
    expect(store.articles()).toHaveLength(100);
  });

  it('removes the articles of a feed', async () => {
    store.articles.set([art('f1:a'), art('f2:b', { feedId: 'f2' })]);
    await db.putMany('articles', store.articles());
    await store.removeFeed('f1');
    await store.removeFeed('unknown');
    expect(store.articles().map((a) => a.id)).toEqual(['f2:b']);
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
