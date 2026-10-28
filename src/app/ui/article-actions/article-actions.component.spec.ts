import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsStore } from '../../rss/settings.store';
import { ViewStore } from '../../rss/view.store';
import { DialogService } from '../services/dialog.service';
import { ArticleActionsComponent } from './article-actions.component';

describe('ArticleActionsComponent', () => {
  const store = { markAllRead: vi.fn() };
  const dialog = { confirm: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    store.markAllRead.mockReset();
    dialog.confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), { provide: ViewStore, useValue: store }, { provide: DialogService, useValue: dialog }],
    });
  });

  const setup = (radial: boolean) => {
    const fixture = TestBed.createComponent(ArticleActionsComponent);
    fixture.componentRef.setInput('radial', radial);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('marks everything read after confirmation', async () => {
    const { root } = setup(false);
    dialog.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const button = root.querySelector<HTMLButtonElement>('button')!;
    button.click();
    await vi.waitFor(() => expect(dialog.confirm).toHaveBeenCalledTimes(1));
    expect(store.markAllRead).not.toHaveBeenCalled();
    button.click();
    await vi.waitFor(() => expect(store.markAllRead).toHaveBeenCalledTimes(1));
  });

  it('switches layouts', () => {
    const { fixture, root } = setup(false);
    const settings = TestBed.inject(SettingsStore);
    const group = root.querySelectorAll<HTMLButtonElement>('[role="group"] button');
    expect(group).toHaveLength(3);
    group[0].click();
    expect(settings.layout()).toBe('list');
    group[2].click();
    fixture.detectChanges();
    expect(settings.layout()).toBe('card');
    expect(group[2].getAttribute('aria-pressed')).toBe('true');
  });

  it('exposes the same actions in the radial menu', async () => {
    const { fixture, root } = setup(true);
    const settings = TestBed.inject(SettingsStore);
    const items = root.querySelectorAll<HTMLButtonElement>('.radial-item');
    expect(items).toHaveLength(4);
    dialog.confirm.mockResolvedValue(true);
    items[0].click();
    await vi.waitFor(() => expect(store.markAllRead).toHaveBeenCalled());
    items[1].click();
    expect(settings.layout()).toBe('list');
  });
});
