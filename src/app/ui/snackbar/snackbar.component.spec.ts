import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ImageCache } from '../../rss/services/image-cache.service';
import { SnackbarService } from './snackbar.service';
import { SnackbarComponent } from './snackbar.component';

describe('SnackbarComponent', () => {
  const setup = () => {
    TestBed.configureTestingModule({ providers: [{ provide: ImageCache, useValue: { url: async (u: string) => u } }] });
    class NoObserver {
      observe(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', NoObserver);
    const fixture = TestBed.createComponent(SnackbarComponent);
    fixture.detectChanges();
    return { fixture, service: TestBed.inject(SnackbarService), root: fixture.nativeElement as HTMLElement };
  };

  it('renders nothing when idle', () => {
    expect(setup().root.querySelector('[role]')).toBeNull();
  });

  it('shows plain messages that can be closed', () => {
    const { fixture, service, root } = setup();
    service.show('Hello', { duration: 0 });
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Hello');
    root.querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="status"]')).toBeNull();
  });

  it('shows errors, titles, images and actions', () => {
    const { fixture, service, root } = setup();
    service.show('Boom', { kind: 'error', duration: 0 });
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).not.toBeNull();

    const run = vi.fn();
    service.show('text', { kind: 'info', title: 'Title', image: 'icons/x.png', duration: 0, actions: [{ label: 'Go', primary: true, run }, { label: 'Later', run: vi.fn() }] });
    fixture.detectChanges();
    expect(root.querySelector('img')).not.toBeNull();
    expect(root.textContent).toContain('Title');
    root.querySelectorAll<HTMLButtonElement>('button')[0].click();
    expect(run).toHaveBeenCalled();
  });
});
