import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppPromptComponent } from '../pwa/app-prompt/app-prompt.component';
import { PushService } from '../pwa/services/push.service';
import { SyncService } from '../pwa/services/sync.service';
import { ArticlesStore } from '../rss/stores/articles.store';
import { RefreshService } from '../rss/services/refresh.service';
import { ArticleActionsComponent } from '../ui/article-actions/article-actions.component';
import { ArticleDetailActionsComponent } from '../ui/article-detail-actions/article-detail-actions.component';
import { DialogComponent } from '../ui/dialog/dialog.component';
import { DrawerContentComponent } from '../ui/drawer-content/drawer-content.component';
import { DrawerService } from '../ui/drawer-content/drawer.service';
import { LayoutService } from '../ui/services/layout.service';
import { SnackbarComponent } from '../ui/snackbar/snackbar.component';
import { TopBarComponent } from '../ui/top-bar/top-bar.component';
import { RootComponent } from './root.component';

@Component({ selector: 'rss-top-bar', template: '' })
class TopBarStub {
  readonly actions = input(false);
  readonly articleId = input<string | null>(null);
  readonly options = input('');
}
@Component({ selector: 'rss-article-actions', template: '' })
class ActionsStub {
  readonly radial = input(false);
}
@Component({ selector: 'rss-article-detail-actions', template: '' })
class DetailStub {
  readonly id = input('');
  readonly radial = input(false);
}
@Component({ selector: 'rss-drawer-content', template: '' })
class DrawerStub {}
@Component({ selector: 'rss-app-prompt', template: '' })
class PromptStub {}
@Component({ selector: 'rss-snackbar', template: '' })
class SnackStub {}
@Component({ selector: 'rss-dialog', template: '' })
class DialogStub {}

const pointer = (type: string, x = 0, y = 0, extra: Record<string, unknown> = {}): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0, ...extra });
  return e;
};
const touch = (type: string, x: number, y: number): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { touches: [{ clientX: x, clientY: y }] });
  return e;
};

describe('RootComponent', () => {
  const store = { load: vi.fn(), unreadTotal: signal(0), online: signal(true), refreshAll: vi.fn(() => Promise.resolve()) };
  const sidebar = signal(false);

  beforeEach(() => {
    store.unreadTotal.set(0);
    store.online.set(true);
    sidebar.set(false);
    TestBed.resetTestingModule();
    TestBed.overrideComponent(RootComponent, {
      remove: { imports: [TopBarComponent, DrawerContentComponent, AppPromptComponent, SnackbarComponent, DialogComponent, ArticleActionsComponent, ArticleDetailActionsComponent] },
      add: { imports: [TopBarStub, DrawerStub, PromptStub, SnackStub, DialogStub, ActionsStub, DetailStub] },
    });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: ArticlesStore, useValue: store },
        { provide: RefreshService, useValue: store },
        { provide: PushService, useValue: {} },
        { provide: SyncService, useValue: {} },
        { provide: LayoutService, useValue: { sidebar } },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (navigator as unknown as Record<string, unknown>)['setAppBadge'];
    delete (navigator as unknown as Record<string, unknown>)['clearAppBadge'];
  });

  const setup = () => {
    const fixture = TestBed.createComponent(RootComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const shell = root.querySelector<HTMLElement>('div')!;
    shell.setPointerCapture = vi.fn();
    shell.releasePointerCapture = vi.fn();
    return { fixture, root, shell, drawer: TestBed.inject(DrawerService), router: TestBed.inject(Router) };
  };

  it('loads the store and shows the offline banner', () => {
    store.online.set(false);
    const { root } = setup();
    expect(store.load).toHaveBeenCalled();
    expect(root.querySelector('.banner')).not.toBeNull();
  });

  it('updates the app badge from the unread count', () => {
    const set = vi.fn(() => Promise.reject(new Error('x')));
    const clear = vi.fn(() => Promise.reject(new Error('x')));
    Object.assign(navigator, { setAppBadge: set, clearAppBadge: clear });
    const { fixture } = setup();
    expect(clear).toHaveBeenCalled();
    store.unreadTotal.set(3);
    fixture.detectChanges();
    TestBed.tick();
    expect(set).toHaveBeenCalledWith(3);
  });

  it('tracks the route and closes the drawer', async () => {
    const { fixture, root, drawer, router } = setup();
    const main = root.querySelector('main')!;
    main.scrollTo = vi.fn() as never;
    drawer.show();
    await router.navigateByUrl('/article/a%201?x=1');
    fixture.detectChanges();
    expect(drawer.opened()).toBe(false);
    expect(main.scrollTo).toHaveBeenCalled();
    expect(root.querySelector('rss-article-detail-actions')).not.toBeNull();
    await router.navigateByUrl('/article/a%201');
    await router.navigateByUrl('/feeds');
    fixture.detectChanges();
    expect(root.querySelector('rss-top-bar')).not.toBeNull();
    await router.navigateByUrl('/about');
    await router.navigateByUrl('/');
    fixture.detectChanges();
    expect(root.querySelector('rss-article-actions')).not.toBeNull();
  });

  it('opens external links in a new tab, leaving in-app ones alone', () => {
    const { shell } = setup();
    const external = document.createElement('a');
    external.href = 'https://elsewhere.com/x';
    const child = document.createElement('span');
    external.appendChild(child);
    const internal = document.createElement('a');
    internal.href = '/article/a';
    const mail = document.createElement('a');
    mail.href = 'mailto:a@b.c';
    shell.append(external, internal, mail);
    for (const el of [child, internal, mail]) el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(external.target).toBe('_blank');
    expect(external.rel).toBe('noopener noreferrer');
    expect(internal.target).toBe('');
    expect(mail.target).toBe('');
  });

  it('adds a tooltip from the aria-label of icon buttons', () => {
    const { shell } = setup();
    const icon = document.createElement('button');
    icon.className = 'icon-btn';
    icon.setAttribute('aria-label', 'Aide');
    const text = document.createElement('button');
    text.setAttribute('aria-label', 'Texte');
    text.textContent = 'Word';
    shell.appendChild(icon);
    shell.appendChild(text);
    icon.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    text.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    shell.dispatchEvent(new MouseEvent('mouseover'));
    expect(icon.title).toBe('Aide');
    expect(text.title).toBe('');
  });

  it('opens the drawer by dragging from the edge', () => {
    const { fixture, root, shell, drawer } = setup();
    const edge = root.querySelector('div > div.touch-none')!;
    edge.dispatchEvent(pointer('pointerdown', 2, 0));
    shell.dispatchEvent(pointer('pointermove', 100, 0, { pointerId: 2 }));
    shell.dispatchEvent(pointer('pointermove', 100, 0));
    shell.dispatchEvent(pointer('pointermove', 150, 0));
    fixture.detectChanges();
    const move = touch('touchmove', 100, 0);
    document.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(true);
    shell.dispatchEvent(pointer('pointerup', 150, 0));
    expect(drawer.opened()).toBe(true);
    root.querySelector<HTMLElement>('div.bg-black\\/55')!.click();
    expect(drawer.opened()).toBe(true);
    root.querySelector<HTMLElement>('div.bg-black\\/55')!.click();
    expect(drawer.opened()).toBe(false);
  });

  it('closes the drawer when dragged back and ignores vertical or non-edge drags', () => {
    const { root, shell, drawer } = setup();
    drawer.show();
    shell.dispatchEvent(pointer('pointerdown', 250, 0, { pointerType: 'mouse', button: 2 }));
    shell.dispatchEvent(pointer('pointerdown', 250, 0));
    shell.dispatchEvent(pointer('pointermove', 100, 0));
    shell.dispatchEvent(pointer('pointerup', 100, 0));
    expect(drawer.opened()).toBe(false);
    shell.dispatchEvent(pointer('pointerdown', 100, 100));
    shell.dispatchEvent(pointer('pointerup', 100, 100));
    root.querySelector('div > div.touch-none')!.dispatchEvent(pointer('pointerdown', 2, 0));
    shell.dispatchEvent(pointer('pointermove', 2, 50));
    shell.dispatchEvent(pointer('pointerup', 2, 50));
    expect(drawer.opened()).toBe(false);
  });

  it('keeps the sidebar layout static', () => {
    sidebar.set(true);
    const { shell, drawer } = setup();
    shell.dispatchEvent(pointer('pointerdown', 2, 0));
    expect(drawer.opened()).toBe(false);
  });

  it('prevents browser back swipes that start on a screen edge', () => {
    setup();
    document.dispatchEvent(touch('touchstart', 5, 5));
    const horizontal = touch('touchmove', 40, 6);
    document.dispatchEvent(horizontal);
    expect(horizontal.defaultPrevented).toBe(true);
    const vertical = touch('touchmove', 5, 60);
    document.dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(false);
    document.dispatchEvent(touch('touchmove', 5, 60));
    document.dispatchEvent(touch('touchstart', 500, 5));
    document.dispatchEvent(touch('touchmove', 520, 5));
    document.dispatchEvent(new Event('touchstart'));
    document.dispatchEvent(new Event('touchmove'));
  });

  it('scrolls back after a field loses focus', () => {
    vi.useFakeTimers();
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    setup();
    document.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(100);
    expect(scroll).toHaveBeenCalledWith(0, 0);
    scroll.mockClear();
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    document.dispatchEvent(new Event('focusout'));
    vi.advanceTimersByTime(100);
    expect(scroll).not.toHaveBeenCalled();
    input.remove();
    scroll.mockRestore();
  });

  it('refreshes through the pull-to-refresh hook', () => {
    const { fixture } = setup();
    (fixture.componentInstance as unknown as { refresh(): Promise<void> }).refresh();
    expect(store.refreshAll).toHaveBeenCalled();
  });
});
