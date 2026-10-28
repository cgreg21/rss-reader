import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ArticlesStore } from '../../rss/stores/articles.store';
import { ViewStore } from '../../rss/stores/view.store';
import { DrawerService } from '../drawer-content/drawer.service';
import { TopBarComponent } from './top-bar.component';

describe('TopBarComponent', () => {
  const store = {
    search: signal(''),
    mediaFilter: signal('all'),
    unreadTotal: signal(3),
    scopeTitle: signal('Scope'),
    article: () => undefined,
    markAllRead: vi.fn(),
  };

  beforeEach(() => {
    store.search.set('');
    store.unreadTotal.set(3);
    store.scopeTitle.set('Scope');
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }]), { provide: ViewStore, useValue: store }, { provide: ArticlesStore, useValue: store }] });
  });

  const setup = (inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(TopBarComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('shows the scope title, unread badge and opens the drawer', () => {
    const { fixture, root } = setup({ actions: true });
    expect(root.querySelector('strong')?.textContent).toContain('Scope');
    expect(root.querySelector('rss-article-actions')).not.toBeNull();
    const menu = root.querySelector<HTMLButtonElement>('[aria-label="Menu"]')!;
    expect(menu.textContent).toContain('3');
    store.unreadTotal.set(150);
    fixture.detectChanges();
    expect(menu.textContent).toContain('99+');
    store.unreadTotal.set(0);
    fixture.detectChanges();
    expect(menu.textContent).not.toContain('3');
    menu.click();
    expect(TestBed.inject(DrawerService).opened()).toBe(true);
  });

  it('falls back to a default title', () => {
    store.scopeTitle.set('');
    expect(setup().root.querySelector('strong')?.textContent).toContain('RSS');
  });

  it('filters through the search box and toggles the mobile search', () => {
    const { fixture, root } = setup();
    const desktop = root.querySelector<HTMLInputElement>('header input')!;
    desktop.value = 'abc';
    desktop.dispatchEvent(new Event('input'));
    expect(store.search()).toBe('abc');

    const toggle = root.querySelector<HTMLButtonElement>('button[aria-label="Rechercher"]')!;
    expect(root.querySelector('header + div')).toBeNull();
    toggle.click();
    fixture.detectChanges();
    const mobile = root.querySelector<HTMLInputElement>('header + div input')!;
    expect(mobile).not.toBeNull();
    mobile.value = 'xyz';
    mobile.dispatchEvent(new Event('input'));
    expect(store.search()).toBe('xyz');
    toggle.click();
    fixture.detectChanges();
    expect(store.search()).toBe('');
    expect(root.querySelector('header + div')).toBeNull();
  });

  it('starts with the search open when a query exists', () => {
    store.search.set('q');
    expect(setup().root.querySelector('header + div input')).not.toBeNull();
  });

  it('renders an options page header', () => {
    const { root } = setup({ options: 'nav.options' });
    expect(root.querySelector('strong')?.textContent).toContain('Options');
    expect(root.querySelectorAll('[aria-label="Retour"]').length).toBe(2);
    expect(root.querySelector('input')).toBeNull();
  });

  it('renders article actions for an article page', () => {
    const { root } = setup({ articleId: 'a1' });
    expect(root.querySelectorAll('rss-article-detail-actions')).toHaveLength(2);
    expect(root.querySelector('[aria-label="Précédent"]')).not.toBeNull();
  });
});
