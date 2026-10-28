import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ArticlesStore } from './articles.store';
import { db } from '../storage/db';
import { FeedsStore } from './feeds.store';
import { Article, Feed } from '../models';
import { SettingsStore } from './settings.store';
import { ViewStore } from './view.store';

const DAY = 86_400_000;
const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: `https://s.com/${id}`, summary: '', content: '', published: Date.now(), read: false, favorite: false, ...over,
});
const feed = (id: string, over: Partial<Feed> = {}): Feed => ({ id, url: `https://${id}.com/rss`, title: id, categoryId: null, ...over });

describe('ViewStore', () => {
  let store: ViewStore;
  let feeds: FeedsStore;
  let articles: ArticlesStore;
  let settings: SettingsStore;

  beforeEach(async () => {
    for (const r of await db.all<{ id: string }>('articles')) await db.remove('articles', r.id);
    localStorage.clear();
    TestBed.resetTestingModule();
    settings = TestBed.inject(SettingsStore);
    feeds = TestBed.inject(FeedsStore);
    articles = TestBed.inject(ArticlesStore);
    store = TestBed.inject(ViewStore);
    const old = Date.now() - 3 * DAY;
    feeds.feeds.set([feed('f1', { categoryId: 'c1', title: 'B' }), feed('f2', { title: 'A' }), feed('f3', { categoryId: 'c1', title: 'C' })]);
    feeds.categories.set([{ id: 'c1', name: 'Cat' }, { id: 'c2', name: 'Empty' }]);
    articles.articles.set([
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

  it('groups feeds by category', () => {
    expect(store.groups().map((g) => g.name)).toEqual(['Cat', 'Autres']);
    expect(store.groups()[0].unread).toBe(1);
    store.unreadOnly.set(false);
    expect(store.groups().map((g) => g.name)).toEqual(['Cat', 'Empty', 'Autres']);
    feeds.feeds.update((l) => l.filter((f) => f.categoryId));
    expect(store.groups().map((g) => g.name)).not.toContain('Autres');
  });

  it('marks everything visible as read', async () => {
    await store.markAllRead();
    expect(articles.articles().filter((a) => !a.read)).toEqual([]);
  });

  it('remembers the read-state and media filters across launches', () => {
    store.unreadOnly.set(false);
    store.mediaFilter.set('audio');
    expect(localStorage.getItem('rssreader:unread-only')).toBe('0');
    expect(localStorage.getItem('rssreader:media-filter')).toBe('audio');
    TestBed.resetTestingModule();
    const fresh = TestBed.inject(ViewStore);
    expect(fresh.unreadOnly()).toBe(false);
    expect(fresh.mediaFilter()).toBe('audio');
    localStorage.setItem('rssreader:media-filter', 'bogus');
    TestBed.resetTestingModule();
    expect(TestBed.inject(ViewStore).mediaFilter()).toBe('all');
  });

  it('resets the scope when its feed or category is removed', async () => {
    await feeds.putFeed(feed('f1'));
    store.scope.set({ type: 'feed', id: 'f1' });
    await feeds.removeFeed('f1');
    expect(store.scope()).toEqual({ type: 'all' });

    store.scope.set({ type: 'favorites' });
    await feeds.dropFeed('f1');
    expect(store.scope()).toEqual({ type: 'favorites' });

    store.scope.set({ type: 'category', id: 'c1' });
    await feeds.removeCategory('c1');
    expect(store.scope()).toEqual({ type: 'all' });
    await feeds.removeCategory('other');
  });
});
