import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncService } from '../../pwa/services/sync.service';
import { ArticlesStore } from '../../rss/articles.store';
import { RefreshService } from '../../rss/services/refresh.service';
import { Scope, ViewStore } from '../../rss/view.store';
import { DrawerService } from '../services/drawer.service';
import { DrawerContentComponent } from './drawer-content.component';

describe('DrawerContentComponent', () => {
  const store = {
    scope: signal<Scope>({ type: 'all' }),
    unreadOnly: signal(true),
    syncing: signal(false),
    online: signal(true),
    unreadTotal: signal(5),
    unreadToday: signal(1),
    favoriteCount: signal(2),
    laterCount: signal(3),
    unreadByFeed: signal(new Map([['f1', 4]])),
    groups: signal([
      { id: 'c1', name: 'Cat', unread: 4, feeds: [{ id: 'f1', title: 'feed' }] },
      { id: null, name: 'Autres', unread: 0, feeds: [{ id: 'f2', title: 'other' }] },
    ]),
    refreshAll: vi.fn(),
  };
  const sync = { resume: vi.fn() };

  beforeEach(() => {
    store.scope.set({ type: 'all' });
    store.syncing.set(false);
    store.online.set(true);
    store.refreshAll.mockReset();
    sync.resume.mockReset();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }]), { provide: ViewStore, useValue: store }, { provide: ArticlesStore, useValue: store }, { provide: RefreshService, useValue: store }, { provide: SyncService, useValue: sync }] });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(DrawerContentComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('toggles unread / all and refreshes', () => {
    const { root } = setup();
    const toggles = root.querySelectorAll<HTMLButtonElement>('[role="group"] button');
    toggles[1].click();
    expect(store.unreadOnly()).toBe(false);
    toggles[0].click();
    expect(store.unreadOnly()).toBe(true);
    root.querySelector<HTMLButtonElement>('[aria-label="Actualiser"]')!.click();
    expect(store.refreshAll).toHaveBeenCalled();
    expect(sync.resume).toHaveBeenCalled();
  });

  it('navigates through filters, categories and feeds', async () => {
    const { fixture, root } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const drawer = TestBed.inject(DrawerService);
    const items = Array.from(root.querySelectorAll<HTMLButtonElement>('nav button.nav-item'));
    expect(items).toHaveLength(7);
    const expected: Scope[] = [{ type: 'all' }, { type: 'today' }, { type: 'favorites' }, { type: 'later' }, { type: 'category', id: 'c1' }, { type: 'feed', id: 'f1' }, { type: 'feed', id: 'f2' }];
    for (const [i, scope] of expected.entries()) {
      drawer.show();
      items[i].click();
      fixture.detectChanges();
      expect(store.scope()).toEqual(scope);
      expect(items[i].classList.contains('active')).toBe(true);
      expect(drawer.opened()).toBe(false);
    }
    expect(navigate).toHaveBeenCalledTimes(7);
  });

  it('closes the drawer from links and shows the status', () => {
    const { fixture, root } = setup();
    const drawer = TestBed.inject(DrawerService);
    for (const link of Array.from(root.querySelectorAll<HTMLAnchorElement>('a'))) {
      drawer.show();
      link.click();
      expect(drawer.opened()).toBe(false);
    }
    expect(root.querySelector('small')?.textContent).toBeTruthy();
    store.syncing.set(true);
    fixture.detectChanges();
    const syncing = root.querySelector('small')?.textContent;
    store.syncing.set(false);
    store.online.set(false);
    fixture.detectChanges();
    expect(root.querySelector('small')?.textContent).not.toBe(syncing);
    expect(root.querySelector('[data-testid="app-version"]')?.textContent).toMatch(/^v\d/);
  });
});
