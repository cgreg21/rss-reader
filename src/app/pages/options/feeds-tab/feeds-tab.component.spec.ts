import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore } from '../../../rss/articles.store';
import { FeedsStore } from '../../../rss/feeds.store';
import { Article, Feed } from '../../../rss/models';
import { FetchService } from '../../../rss/services/fetch.service';
import { LibraryService } from '../../../rss/services/library.service';
import { DialogService } from '../../../ui/services/dialog.service';
import { FeedsTabComponent } from './feeds-tab.component';

describe('FeedsTabComponent', () => {
  const params = new BehaviorSubject(convertToParamMap({}));
  const store = {
    categories: signal([{ id: 'c1', name: 'Cat' }]),
    feeds: signal<Feed[]>([]),
    articles: signal<Article[]>([]),
    addFeed: vi.fn(),
    addCategory: vi.fn(),
    removeCategory: vi.fn(),
    removeFeed: vi.fn(),
    setFeedCategory: vi.fn(),
  };
  const net = { searchFeeds: vi.fn() };
  const library = { importOpml: vi.fn(), exportOpml: vi.fn(() => '<opml/>') };
  const dialog = { open: vi.fn() };
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };

  beforeEach(() => {
    params.next(convertToParamMap({}));
    store.feeds.set([]);
    store.articles.set([]);
    for (const fn of [store.addFeed, store.addCategory, store.removeCategory, store.removeFeed, store.setFeedCategory, net.searchFeeds, library.importOpml, dialog.open, router.navigate]) fn.mockReset();
    store.addFeed.mockResolvedValue(undefined);
    router.navigate.mockResolvedValue(true);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FeedsStore, useValue: store },
        { provide: ArticlesStore, useValue: store },
        { provide: FetchService, useValue: net },
        { provide: LibraryService, useValue: library },
        { provide: DialogService, useValue: dialog },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      ],
    });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(FeedsTabComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const comp = fixture.componentInstance as any;
    const flush = async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, root, comp, flush };
  };
  const feed = (over: Partial<Feed> = {}): Feed => ({ id: 'f1', url: 'http://f', title: 'Feed', categoryId: 'c1', ...over }) as Feed;

  it('adds a feed and reports errors', async () => {
    const { comp, flush, root } = setup();
    comp.url = 'http://x';
    await comp.add();
    expect(store.addFeed).toHaveBeenCalledWith('http://x', null);
    expect(comp.url).toBe('');
    store.addFeed.mockRejectedValueOnce(new Error('bad feed'));
    await comp.add();
    await flush();
    expect(root.textContent).toContain('bad feed');
    store.addFeed.mockRejectedValueOnce('x');
    await comp.add();
    expect(comp.error()).toBe('Impossible de lire ce flux');
  });

  it('adds a feed shared through the query string', async () => {
    params.next(convertToParamMap({ url: 'http://shared' }));
    setup();
    await vi.waitFor(() => expect(store.addFeed).toHaveBeenCalledWith('http://shared', null));
    expect(router.navigate).toHaveBeenCalled();
    store.addFeed.mockClear();
    params.next(convertToParamMap({ text: 'look https://t.co/x now' }));
    await vi.waitFor(() => expect(store.addFeed).toHaveBeenCalledWith('https://t.co/x', null));
    store.addFeed.mockClear();
    params.next(convertToParamMap({ text: 'nothing' }));
    expect(store.addFeed).not.toHaveBeenCalled();
  });

  it('searches feeds', async () => {
    const { comp, flush, root } = setup();
    await comp.search();
    expect(net.searchFeeds).not.toHaveBeenCalled();
    comp.query = 'news';
    net.searchFeeds.mockResolvedValueOnce([]);
    await comp.search();
    await flush();
    expect(root.textContent).toContain('Aucun résultat');
    net.searchFeeds.mockResolvedValueOnce([{ url: 'http://h', title: 'Hit', description: 'd', subscribers: 5 }]);
    await comp.search();
    await flush();
    expect(root.textContent).toContain('Hit');
    expect(root.textContent).toContain('5 abonnés');
    net.searchFeeds.mockRejectedValueOnce(new Error('x'));
    await comp.search();
    expect(comp.searchError()).toContain('proxy');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    net.searchFeeds.mockRejectedValueOnce(new Error('x'));
    await comp.search();
    expect(comp.searchError()).toBe('Hors ligne.');
    vi.restoreAllMocks();
  });

  it('follows a search hit', async () => {
    const { comp } = setup();
    const hit = { url: 'http://h', title: 'Hit' };
    await comp.follow(hit);
    expect(store.addFeed).toHaveBeenCalledWith('http://h', null);
    store.addFeed.mockRejectedValueOnce(new Error('nope'));
    await comp.follow(hit);
    expect(comp.searchError()).toBe('nope');
    store.addFeed.mockRejectedValueOnce(1);
    await comp.follow(hit);
    expect(comp.searchError()).toBe('Impossible de lire ce flux');
    store.feeds.set([feed({ url: 'http://h' })]);
    expect(comp.followed('http://h')).toBe(true);
  });

  it('shows hit and feed details', () => {
    const { comp } = setup();
    comp.showHitInfo({ url: 'http://h', title: 'Hit', website: 'w', description: 'd', subscribers: 3 });
    expect(dialog.open.mock.calls[0][0].message).toContain('Site web : w');
    store.articles.set([{ feedId: 'f1', published: 1000 } as Article, { feedId: 'f1', published: 2000 } as Article, { feedId: 'other', published: 9 } as Article]);
    comp.showFeedInfo(feed({ lastFetched: 5000, error: 'oops', siteUrl: 's', format: 'rss2' as Feed['format'], description: 'desc' }));
    const message = dialog.open.mock.calls[1][0].message as string;
    expect(message).toContain('Articles : 2');
    expect(message).toContain('Catégorie : Cat');
    expect(message).toContain('Erreur : oops');
    store.articles.set([]);
    comp.showFeedInfo(feed({ categoryId: null }));
    expect(dialog.open.mock.calls[2][0].message).not.toContain('Dernier article');
  });

  it('creates and removes categories', async () => {
    const { comp, root, fixture } = setup();
    comp.newCategory = 'New';
    await comp.addCategory();
    expect(store.addCategory).toHaveBeenCalledWith('New');
    expect(comp.newCategory).toBe('');
    fixture.detectChanges();
    root.querySelector<HTMLButtonElement>('[aria-label="Supprimer"]')!.click();
    expect(store.removeCategory).toHaveBeenCalledWith('c1');
  });

  it('lists followed feeds with their actions', async () => {
    store.feeds.set([feed({ error: 'down', failures: 6 })]);
    const { root, flush } = setup();
    await flush();
    expect(root.textContent).toContain('inactif depuis 6');
    root.querySelector<HTMLButtonElement>('[aria-label="Se désabonner"]')!.click();
    expect(store.removeFeed).toHaveBeenCalledWith('f1');
    root.querySelector<HTMLButtonElement>('[aria-label="Détails du flux"]')!.click();
    expect(dialog.open).toHaveBeenCalled();
    const select = root.querySelectorAll<HTMLSelectElement>('li select')[0];
    select.value = select.options[0].value;
    select.dispatchEvent(new Event('change'));
    expect(store.setFeedCategory).toHaveBeenCalled();
  });

  it('imports and exports OPML', async () => {
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    store.feeds.set([feed()]);
    const { root, flush } = setup();
    const file = (text: string) => {
      const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
      Object.defineProperty(input, 'files', { configurable: true, value: [new File([text], 'x.opml')] });
      input.dispatchEvent(new Event('change'));
    };
    library.importOpml.mockResolvedValueOnce({ added: 2, skipped: 1 });
    file('x');
    await vi.waitFor(() => expect(root.textContent).toContain('2 flux importé(s), 1 ignoré(s).'));
    library.importOpml.mockRejectedValueOnce(new Error('Invalid'));
    file('x');
    await vi.waitFor(async () => {
      await flush();
      expect(root.textContent).toContain('Invalid');
    });
    library.importOpml.mockRejectedValueOnce(0);
    file('x');
    await vi.waitFor(async () => {
      await flush();
      expect(root.textContent).toContain('Import impossible');
    });
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new Event('change'));
    root.querySelector<HTMLButtonElement>('[aria-label="Exporter en OPML"]')!.click();
    expect(spy).toHaveBeenCalled();
    expect(library.exportOpml).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
