import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore } from '../stores/articles.store';
import { db } from '../storage/db';
import { FeedsStore } from '../stores/feeds.store';
import { Article } from '../models';
import { SettingsStore } from '../stores/settings.store';
import { FetchService } from './fetch.service';
import { LibraryService, SyncDoc } from './library.service';
import { RefreshService } from './refresh.service';

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: id, link: '', summary: '', content: '', published: 1, read: false, favorite: false, ...over,
});

describe('LibraryService', () => {
  let lib: LibraryService;
  let feeds: FeedsStore;
  let articles: ArticlesStore;
  let refresh: RefreshService;

  beforeEach(async () => {
    for (const name of ['feeds', 'categories', 'articles'] as const) {
      for (const r of await db.all<{ id: string }>(name)) await db.remove(name, r.id);
    }
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: FetchService, useValue: { download: vi.fn().mockRejectedValue(new Error('x')) } }] });
    TestBed.inject(SettingsStore).autoRefresh.set(0);
    feeds = TestBed.inject(FeedsStore);
    articles = TestBed.inject(ArticlesStore);
    refresh = TestBed.inject(RefreshService);
    lib = TestBed.inject(LibraryService);
    vi.spyOn(refresh, 'refreshAll').mockResolvedValue();
  });

  it('imports OPML, skipping invalid and known urls', async () => {
    await feeds.putFeed({ id: 'k', url: 'https://known.com/rss', title: 'k', categoryId: null });
    feeds.removedFeeds.set(['https://new.com/rss']);
    const xml = `<opml version="2.0"><body><outline text="Cat">
      <outline xmlUrl="https://new.com/rss" title="New"/><outline xmlUrl="https://known.com/rss" title="K"/><outline xmlUrl="::bad" title="Bad"/>
    </outline></body></opml>`;
    expect(await lib.importOpml(xml)).toEqual({ added: 1, skipped: 2 });
    expect(feeds.feeds()).toHaveLength(2);
    expect(feeds.categories()[0].name).toBe('Cat');
    expect(feeds.removedFeeds()).toEqual([]);
    expect(refresh.refreshAll).toHaveBeenCalled();
    expect(await lib.importOpml('<opml><body></body></opml>')).toEqual({ added: 0, skipped: 0 });
  });

  it('exports OPML', async () => {
    await feeds.putFeed({ id: 'a', url: 'https://a.com/rss', title: 'A', categoryId: null });
    expect(lib.exportOpml()).toContain('xmlUrl="https://a.com/rss"');
  });

  it('round-trips a backup', async () => {
    await feeds.putCategory({ id: 'c1', name: 'C' });
    await feeds.putFeed({ id: 'a', url: 'https://a.com/rss', title: 'A', categoryId: 'c1', error: 'e', failures: 2 });
    articles.articles.set([art('a:1', { read: true, feedId: 'a' }), art('a:2', { feedId: 'a' })]);
    const backup = lib.exportBackup();
    const parsed = JSON.parse(backup);
    expect(parsed.feeds[0].error).toBeUndefined();
    expect(parsed.states).toHaveLength(1);

    await feeds.dropFeed('a');
    feeds.categories.set([]);
    articles.articles.set([art('a:1', { feedId: 'a' })]);
    expect(await lib.importBackup(backup)).toEqual({ feeds: 1 });
    expect(articles.articles()[0].read).toBe(true);
    expect(await lib.importBackup(backup)).toEqual({ feeds: 0 });
    expect(await lib.importBackup(JSON.stringify({ feeds: [] }))).toEqual({ feeds: 0 });
    await expect(lib.importBackup('{}')).rejects.toThrow();
  });

  it('builds a sync document', async () => {
    await feeds.putCategory({ id: 'c1', name: 'C' });
    await feeds.putFeed({ id: 'a', url: 'https://a.com/rss', title: 'A', categoryId: 'c1' });
    await feeds.putFeed({ id: 'b', url: 'https://b.com/rss', title: 'B', categoryId: null });
    articles.articles.set([art('a:1', { read: true }), art('a:2')]);
    feeds.removedFeeds.set(['https://gone.com']);
    expect(lib.buildSyncDoc()).toEqual({
      feeds: [{ url: 'https://a.com/rss', title: 'A', category: 'C' }, { url: 'https://b.com/rss', title: 'B', category: null }],
      removed: ['https://gone.com'],
      states: { '1': 1 },
    });
  });

  it('applies a remote sync document', async () => {
    await feeds.putFeed({ id: 'a', url: 'https://a.com/rss', title: 'A', categoryId: null });
    await feeds.putFeed({ id: 'x', url: 'https://x.com/rss', title: 'X', categoryId: null });
    articles.articles.set([art('a:1', { feedId: 'a' })]);
    feeds.removedFeeds.set(['https://old.com']);
    feeds.removedFeeds.set(['https://old.com', 'https://re.com']);
    feeds.noteFollowed('https://re.com');
    await lib.applySyncDoc({
      feeds: [{ url: 'https://a.com/rss', title: 'A', category: null }, { url: 'https://n.com/rss', title: 'N', category: 'Cat' }, { url: 'https://x.com/rss', title: 'X', category: null }],
      removed: ['https://x.com/rss', 'https://re.com'],
      states: { '1': 2 },
    });
    expect(feeds.feeds().map((f) => f.url).sort()).toEqual(['https://a.com/rss', 'https://n.com/rss']);
    expect(feeds.removedFeeds()).toContain('https://x.com/rss');
    expect(articles.article('a:1')?.favorite).toBe(true);
    await lib.applySyncDoc({} as SyncDoc);
  });
});
