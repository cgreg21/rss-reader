import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Article } from '../../rss/models';
import { RssStore } from '../../rss/rss.store';
import { SnackbarService } from '../../ui/services/snackbar.service';
import { ArticleCardComponent } from './article-card.component';

const pointer = (type: string, x = 0, y = 0, extra: Record<string, unknown> = {}): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0, ...extra });
  return e;
};

const article = (over: Partial<Article> = {}): Article => ({
  id: 'a1', feedId: 'f1', title: 'T', link: 'l', summary: 's', content: '', published: 1, read: false, favorite: false, ...over,
});

describe('ArticleCardComponent', () => {
  const store = { patch: vi.fn(), feeds: signal([{ id: 'f1', title: 'Feed' }]) };
  const snackbar = { show: vi.fn() };

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = vi.fn(); });
    vi.useFakeTimers();
    store.patch.mockReset();
    snackbar.show.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), { provide: RssStore, useValue: store }, { provide: SnackbarService, useValue: snackbar }],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const setup = (a: Article = article()) => {
    const fixture = TestBed.createComponent(ArticleCardComponent);
    fixture.componentRef.setInput('article', a);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('article') as HTMLElement;
    el.setPointerCapture = vi.fn();
    return { fixture, el, root: fixture.nativeElement as HTMLElement };
  };

  it('renders the article with its feed title', () => {
    const { root } = setup(article({ image: 'http://i/x.png', later: true, favorite: true, read: true }));
    expect(root.textContent).toContain('Feed');
    expect(root.querySelector('img')).not.toBeNull();
    root.querySelector('img')!.dispatchEvent(new Event('error'));
    expect(root.querySelector('img')).toBeNull();
  });

  it('shows an empty feed title for an unknown feed', () => {
    const { root } = setup(article({ feedId: 'zz' }));
    expect(root.querySelector('span.truncate')!.textContent).toBe('');
  });

  it('navigates on a tap', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown', 5, 5));
    el.dispatchEvent(pointer('pointerup', 5, 5));
    expect(navigate).toHaveBeenCalledWith(['/article', 'a1']);
  });

  it('ignores secondary mouse buttons and other pointers', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown', 5, 5, { pointerType: 'mouse', button: 2 }));
    el.dispatchEvent(pointer('pointerup', 5, 5, { pointerType: 'mouse', button: 2 }));
    el.dispatchEvent(pointer('pointerdown', 5, 5));
    el.dispatchEvent(pointer('pointermove', 50, 5, { pointerId: 2 }));
    el.dispatchEvent(pointer('pointerup', 5, 5, { pointerId: 2 }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('toggles read-later on a long press and does not navigate', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: vibrate });
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    el.dispatchEvent(pointer('pointerup'));
    expect(store.patch).toHaveBeenCalledWith('a1', { later: true });
    expect(snackbar.show).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    delete (navigator as unknown as Record<string, unknown>)['vibrate'];
  });

  it('cancels the long press when moving', () => {
    const { el } = setup(article({ later: true }));
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 8, 0));
    vi.advanceTimersByTime(600);
    expect(store.patch).not.toHaveBeenCalled();
  });

  it('abandons vertical gestures', () => {
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 0, 30));
    el.dispatchEvent(pointer('pointermove', 60, 30));
    el.dispatchEvent(pointer('pointerup', 60, 30));
    expect(store.patch).not.toHaveBeenCalled();
  });

  it.each([
    [-150, 'LU', { read: true }, false],
    [150, 'FAVORI', { favorite: true }, false],
    [-150, 'NON LU', { read: false }, true],
  ])('flings the card at %i', (dx, label, patch, state) => {
    const { fixture, el, root } = setup(article(state ? { read: true } : {}));
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', dx / 2, 0));
    fixture.detectChanges();
    expect(root.textContent).toMatch(/LU|FAVORI|RETIRER/);
    el.dispatchEvent(pointer('pointermove', dx, 0));
    fixture.detectChanges();
    expect(root.textContent).toContain(label);
    el.dispatchEvent(pointer('pointerup', dx, 0));
    vi.advanceTimersByTime(200);
    expect(store.patch).toHaveBeenCalledWith('a1', patch);
  });

  it('toggles favorite off and ignores re-entrant flings', () => {
    const { fixture, el } = setup(article({ favorite: true }));
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => cb());
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 150, 0));
    el.dispatchEvent(pointer('pointerup', 150, 0));
    el.dispatchEvent(pointer('pointerdown'));
    (fixture.componentInstance as unknown as { fling(d: 'left'): void }).fling('left');
    vi.advanceTimersByTime(200);
    expect(store.patch).toHaveBeenCalledTimes(1);
    expect(store.patch).toHaveBeenCalledWith('a1', { favorite: false });
  });

  it('snaps back below the threshold and on cancel', () => {
    const { el } = setup();
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 40, 0));
    el.dispatchEvent(pointer('pointerup', 40, 0));
    el.dispatchEvent(pointer('pointerdown'));
    el.dispatchEvent(pointer('pointermove', 40, 0));
    el.dispatchEvent(new Event('pointercancel'));
    expect(store.patch).not.toHaveBeenCalled();
  });
});
