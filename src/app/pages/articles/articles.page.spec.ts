import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Article } from '../../rss/models';
import { RssStore } from '../../rss/rss.store';
import { SettingsStore } from '../../rss/settings.store';
import { SnackbarService } from '../../ui/services/snackbar.service';
import { ArticlesPage } from './articles.page';

const article = (over: Partial<Article> = {}): Article => ({
  id: 'a1', feedId: 'f1', title: 'Title', link: 'l', summary: 'sum', content: '', published: 1, read: false, favorite: false, ...over,
});

describe('ArticlesPage', () => {
  const visible = signal<Article[]>([]);
  const feeds = signal<{ id: string; title: string }[]>([]);
  const store = { visible, feeds, patch: vi.fn() };
  const snackbar = { show: vi.fn() };
  const layout = signal<'card' | 'list' | 'other'>('list');

  beforeEach(() => {
    visible.set([]);
    feeds.set([]);
    layout.set('list');
    store.patch.mockReset();
    snackbar.show.mockReset();
    vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: RssStore, useValue: store },
        { provide: SettingsStore, useValue: { layout, activeProxy: signal('') } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(ArticlesPage);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('invites to add a first feed, then reports an empty list', () => {
    const { fixture, root } = setup();
    expect(root.querySelector('a[href="/feeds"]')).not.toBeNull();
    feeds.set([{ id: 'f1', title: 'Feed' }]);
    fixture.detectChanges();
    expect(root.querySelector('a[href="/feeds"]')).toBeNull();
    expect(root.querySelector('p')).not.toBeNull();
  });

  it('renders the card layout', () => {
    visible.set([article()]);
    layout.set('card');
    const { root } = setup();
    expect(root.querySelector('rss-card-list')).not.toBeNull();
  });

  it.each(['list', 'other'] as const)('renders the %s layout and runs the actions', (mode) => {
    layout.set(mode);
    feeds.set([{ id: 'f1', title: 'Feed' }]);
    visible.set([article({ image: 'http://i/x.png', favorite: true, later: true }), article({ id: 'a2', feedId: 'zz', read: true })]);
    const { fixture, root } = setup();
    expect(root.textContent).toContain('Feed');
    const page = fixture.componentInstance as unknown as { toggleRead(a: Article): void; toggleFavorite(a: Article): void; toggleLater(a: Article): void };
    const [on, off] = visible();
    page.toggleRead(on);
    page.toggleRead(off);
    page.toggleFavorite(on);
    page.toggleFavorite(off);
    page.toggleLater(on);
    page.toggleLater(off);
    expect(store.patch).toHaveBeenCalledWith('a1', { read: true });
    expect(store.patch).toHaveBeenCalledWith('a2', { read: false });
    expect(store.patch).toHaveBeenCalledWith('a1', { favorite: false });
    expect(store.patch).toHaveBeenCalledWith('a2', { later: true });
    expect(snackbar.show).toHaveBeenCalledTimes(6);
    const img = root.querySelector('img');
    img?.dispatchEvent(new Event('error'));
  });
});
