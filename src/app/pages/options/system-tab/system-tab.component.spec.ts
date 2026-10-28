import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { ImageCache } from '../../../rss/services/image-cache.service';
import { SettingsStore } from '../../../rss/settings.store';
import { PushService } from '../../../pwa/services/push.service';
import { DialogService } from '../../../ui/services/dialog.service';
import { signal } from '@angular/core';
import { SystemTabComponent } from './system-tab.component';

describe('SystemTabComponent', () => {
  const push = { supported: true, enabled: signal(false), busy: signal(false), error: signal(''), url: signal(''), enable: vi.fn(), disable: vi.fn(), setUrl: vi.fn() };
  const images = { count: signal(2), refreshCount: vi.fn(), clear: vi.fn() };
  const dialog = { confirm: vi.fn() };

  const setup = (supported = true) => {
    localStorage.clear();
    TestBed.resetTestingModule();
    Object.assign(push, { supported });
    push.enable.mockReset();
    push.disable.mockReset();
    images.clear.mockReset();
    dialog.confirm.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: PushService, useValue: push },
        { provide: ImageCache, useValue: images },
        { provide: DialogService, useValue: dialog },
      ],
    });
    const fixture = TestBed.createComponent(SystemTabComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, settings: TestBed.inject(SettingsStore) };
  };

  it('changes the auto refresh interval', async () => {
    const { fixture, root, settings } = setup();
    await fixture.whenStable();
    const select = root.querySelector<HTMLSelectElement>('select')!;
    select.value = select.options[2].value;
    select.dispatchEvent(new Event('change'));
    expect(settings.autoRefresh()).toBe(15);
    expect(images.refreshCount).toHaveBeenCalled();
  });

  it('toggles push notifications and edits the worker url', () => {
    const { fixture, root } = setup();
    const toggle = root.querySelector<HTMLButtonElement>('[aria-label="Activer les notifications"]')!;
    toggle.click();
    expect(push.enable).toHaveBeenCalled();
    push.enabled.set(true);
    push.error.set('oops');
    fixture.detectChanges();
    toggle.click();
    expect(push.disable).toHaveBeenCalled();
    expect(root.textContent).toContain('oops');
    const input = root.querySelector<HTMLInputElement>('input[name="pushUrl"]')!;
    input.value = 'https://w.com';
    input.dispatchEvent(new Event('input'));
    expect(push.setUrl).toHaveBeenCalledWith('https://w.com');
    push.enabled.set(false);
    push.error.set('');
  });

  it('shows a notice when push is unsupported', () => {
    const { root } = setup(false);
    expect(root.querySelector('input[name="pushUrl"]')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('[aria-label="Activer les notifications"]')!.disabled).toBe(true);
  });

  it('configures the proxy', async () => {
    const { fixture, root, settings } = setup();
    const input = root.querySelector<HTMLInputElement>('input[name="proxy"]')!;
    input.value = ' https://p.com ';
    input.dispatchEvent(new Event('input'));
    expect(settings.proxy()).toBe('https://p.com');
    root.querySelector<HTMLButtonElement>('[aria-label="Activer le proxy CORS"]')!.click();
    fixture.detectChanges();
    expect(settings.proxyEnabled()).toBe(false);
  });

  it('clears the image cache after confirmation', async () => {
    const { root } = setup();
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Vider'))!;
    dialog.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    button.click();
    await vi.waitFor(() => expect(dialog.confirm).toHaveBeenCalledTimes(1));
    expect(images.clear).not.toHaveBeenCalled();
    button.click();
    await vi.waitFor(() => expect(images.clear).toHaveBeenCalled());
  });
});
