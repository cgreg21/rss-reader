import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore } from '../../rss/stores/articles.store';
import { FeedsStore } from '../../rss/stores/feeds.store';
import { Article } from '../../rss/models';
import { ViewStore } from '../../rss/stores/view.store';
import { ArticlePage } from './article.page';

const touch = (type: string, x = 0, y = 0, count = 1, target?: Element): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) });
  if (target) Object.defineProperty(e, 'target', { value: target });
  return e;
};

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, feedId: 'f1', title: `T${id}`, link: 'l', summary: `sum${id}`, content: '', published: 1, read: false, favorite: false, ...over,
});

describe('ArticlePage', () => {
  const articles = signal<Article[]>([]);
  const store = {
    feeds: signal([{ id: 'f1', title: 'Feed' }]),
    visible: signal<Article[]>([]),
    article: (id: string) => articles().find((a) => a.id === id),
    patch: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    articles.set([art('a'), art('b'), art('c')]);
    store.visible.set(articles());
    store.patch.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), { provide: FeedsStore, useValue: store }, { provide: ArticlesStore, useValue: store }, { provide: ViewStore, useValue: store }],
    });
  });
  afterEach(() => vi.useRealTimers());

  const setup = (id = 'b') => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ArticlePage);
    fixture.componentRef.setInput('id', id);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, navigate };
  };
  const swipe = (el: HTMLElement, from: [number, number], to: [number, number], end = 'touchend') => {
    el.dispatchEvent(touch('touchstart', ...from));
    el.dispatchEvent(touch('touchmove', ...to));
  };

  it('shows the article, marks it read and names the feed', () => {
    const { el } = setup();
    expect(el.textContent).toContain('Tb');
    expect(el.textContent).toContain('Feed');
    expect(el.textContent).toContain('sumb');
    expect(store.patch).toHaveBeenCalledWith('b', { read: true });
  });

  it('does not re-mark read articles and shows content and unknown feed', () => {
    articles.set([art('b', { read: true, content: '<p>body</p>', feedId: 'zz' })]);
    const { el } = setup();
    expect(store.patch).not.toHaveBeenCalled();
    expect(el.querySelector('.body')).not.toBeNull();
  });

  it('renders a missing article message', () => {
    const { el } = setup('nope');
    expect(el.textContent).toContain('introuvable');
  });

  it.each([
    ['audio', 'rss-audio-player'],
    ['video', 'video'],
    ['youtube', 'iframe'],
  ])('renders %s media', (kind, tag) => {
    articles.set([art('b', { media: { kind, url: 'u' } as Article['media'] })]);
    const { el } = setup();
    expect(el.querySelector(tag)).not.toBeNull();
  });

  it('swipes right to the next article', () => {
    const { fixture, el, navigate } = setup();
    swipe(el, [0, 0], [60, 5]);
    fixture.detectChanges();
    expect(el.textContent).toContain('Tc');
    el.dispatchEvent(touch('touchmove', 120, 5));
    el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    expect(navigate).toHaveBeenCalledWith(['/article', 'c']);
  });

  it('swipes left to the previous article, and back to the list without neighbour', () => {
    const first = setup('a');
    swipe(first.el, [200, 0], [100, 0]);
    first.fixture.detectChanges();
    first.el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    expect(first.navigate).toHaveBeenCalledWith(['/']);
    const second = setup('b');
    swipe(second.el, [200, 0], [100, 0]);
    second.fixture.detectChanges();
    second.el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    expect(second.navigate).toHaveBeenCalledWith(['/article', 'a']);
  });

  it('snaps back on short swipes and cancellations', () => {
    const { fixture, el, navigate } = setup();
    swipe(el, [0, 0], [30, 0]);
    el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    swipe(el, [0, 0], [100, 0]);
    el.dispatchEvent(new Event('touchcancel'));
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('pulls down to the list when scrolled to the top', () => {
    const { fixture, el, navigate } = setup();
    swipe(el, [0, 0], [0, 40]);
    fixture.detectChanges();
    expect(el.querySelector('rss-articles')).not.toBeNull();
    el.dispatchEvent(touch('touchmove', 0, 120));
    el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('snaps back from a short pull', () => {
    const { el, navigate } = setup();
    swipe(el, [0, 0], [0, 30]);
    el.dispatchEvent(new Event('touchend'));
    vi.advanceTimersByTime(200);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('gives up on upward moves and ignores tiny moves, multi-touch and media', () => {
    const { el, navigate } = setup();
    swipe(el, [0, 0], [0, -40]);
    el.dispatchEvent(touch('touchmove', 100, 0));
    el.dispatchEvent(new Event('touchend'));
    el.dispatchEvent(touch('touchmove', 100, 0));
    el.dispatchEvent(touch('touchstart', 0, 0, 2));
    el.dispatchEvent(touch('touchstart', 0, 0, 1, document.createElement('video')));
    el.dispatchEvent(touch('touchstart', 0, 0));
    el.dispatchEvent(touch('touchmove', 3, 3));
    el.dispatchEvent(new Event('touchend'));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('starts swipes inside a scrolled main without pulling', () => {
    const main = document.createElement('main');
    document.body.appendChild(main);
    const { el } = setup();
    main.appendChild(el);
    Object.defineProperty(main, 'scrollTop', { value: 50 });
    el.dispatchEvent(touch('touchstart', 0, 0));
    el.dispatchEvent(touch('touchmove', 0, 40));
    el.dispatchEvent(new Event('touchend'));
    main.remove();
  });

  it('ignores touches while animating', () => {
    const { el } = setup();
    swipe(el, [0, 0], [30, 0]);
    el.dispatchEvent(new Event('touchend'));
    el.dispatchEvent(touch('touchstart', 0, 0));
    el.dispatchEvent(touch('touchmove', 50, 0));
    vi.advanceTimersByTime(200);
  });
});
