import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Article } from '../../rss/models';
import { ArticlesStore } from '../../rss/stores/articles.store';
import { FeedsStore } from '../../rss/stores/feeds.store';
import { SettingsStore } from '../../rss/stores/settings.store';
import { ViewStore } from '../../rss/stores/view.store';
import { LongPressDirective } from '../../ui/directives/long-press.directive';
import { SwipeActionsDirective } from '../../ui/directives/swipe-actions.directive';
import { ArticlesPage } from './articles.page';

const article = (over: Partial<Article> = {}): Article => ({
  id: 'a1', feedId: 'f1', title: 'Title', link: 'l', summary: 'sum', content: '', published: 1, read: false, favorite: false, ...over,
});

describe('ArticlesPage', () => {
  const visible = signal<Article[]>([]);
  const feeds = signal<{ id: string; title: string }[]>([]);
  const articles = { toggle: vi.fn() };
  const layout = signal<'card' | 'list' | 'other'>('list');

  beforeEach(() => {
    visible.set([]);
    feeds.set([]);
    layout.set('list');
    articles.toggle.mockReset();
    vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ViewStore, useValue: { visible } },
        { provide: FeedsStore, useValue: { feeds } },
        { provide: ArticlesStore, useValue: articles },
        { provide: SettingsStore, useValue: { layout, activeProxy: signal(''), language: signal('fr') } },
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
    const [on] = visible();
    expect(root.querySelectorAll('a[href^="/article/"]')).toHaveLength(2);
    expect(root.querySelectorAll('h2 .text-yellow-300')).toHaveLength(1);
    const first = fixture.debugElement.query(By.directive(SwipeActionsDirective));
    first.injector.get(SwipeActionsDirective).swipeLeft.emit();
    first.injector.get(SwipeActionsDirective).swipeRight.emit();
    first.injector.get(LongPressDirective).rssLongPress.emit();
    expect(articles.toggle.mock.calls).toEqual([[on, 'read'], [on, 'favorite'], [on, 'later']]);
    const img = root.querySelector('img');
    img?.dispatchEvent(new Event('error'));
  });
});
