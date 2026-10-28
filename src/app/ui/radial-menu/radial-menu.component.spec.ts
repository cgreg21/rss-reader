import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';

import { RadialItem, RadialMenuComponent } from './radial-menu.component';

@Component({ imports: [RadialMenuComponent], template: `<rss-radial-menu [items]="items()" />` })
class HostComponent {
  items = signal<RadialItem[]>([]);
}

describe('RadialMenuComponent', () => {
  const setup = (items: RadialItem[]) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.items.set(items);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const toggle = () => root.querySelector<HTMLButtonElement>('button[aria-label="Actions"]')!;
    return { fixture, root, toggle };
  };

  it('renders buttons, routes and links, and opens/closes', () => {
    const run = vi.fn();
    const { fixture, root, toggle } = setup([
      { label: 'run', icon: 'a', run, pulse: true, activeClass: 'x' },
      { label: 'route', icon: 'b', route: '/feeds' },
      { label: 'href', icon: 'c', href: 'https://a.com' },
      { label: 'noop', icon: 'd', disabled: true },
      { label: 'five', icon: 'e' },
    ]);
    expect(root.querySelectorAll('.radial-item')).toHaveLength(5);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector<HTMLElement>('.radial-item')!.getAttribute('style')).toContain('opacity: 1');

    root.querySelector<HTMLButtonElement>('button[aria-label="run"]')!.click();
    expect(run).toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('button[aria-label="noop"]')!.click();
    root.querySelector<HTMLAnchorElement>('a[aria-label="route"]')!.click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');

    toggle().click();
    fixture.detectChanges();
    root.querySelector<HTMLElement>('.fixed.inset-0')!.click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    const link = root.querySelector<HTMLAnchorElement>('a[aria-label="href"]')!;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('places a single item and long lists', () => {
    const { root } = setup([{ label: 'one', icon: 'a' }]);
    expect(root.querySelectorAll('.radial-item')).toHaveLength(1);
    const many = setup(Array.from({ length: 6 }, (_, i) => ({ label: `i${i}`, icon: 'x' })));
    expect(many.root.querySelectorAll('.radial-item')).toHaveLength(6);
  });
});
