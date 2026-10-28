import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateService } from '../../pwa/services/update.service';
import { StorageUsageService } from '../../rss/services/storage-usage.service';
import { OnboardingService } from '../../ui/onboarding/onboarding.service';
import { AboutPage } from './about.page';

describe('AboutPage', () => {
  const available = signal(false);
  const updates = { available, apply: vi.fn(), check: vi.fn() };
  const usage = { measure: vi.fn() };

  beforeEach(() => {
    available.set(false);
    updates.apply.mockReset();
    updates.check.mockReset();
    usage.measure.mockReset().mockResolvedValue({ entries: [{ key: 'storage.articles', bytes: 2_500_000 }], used: 4_000_000, quota: 16_000_000 });
    TestBed.configureTestingModule({ providers: [{ provide: UpdateService, useValue: updates }, { provide: StorageUsageService, useValue: usage }] });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('shows the storage used by each kind of data and the quota', async () => {
    const { fixture, root } = setup();
    expect(root.textContent).toContain('Mesure en cours');
    await vi.waitFor(() => expect(usage.measure).toHaveResolved());
    fixture.detectChanges();
    expect(root.textContent).toContain('Articles');
    expect(root.textContent).toMatch(/2,5\sMo/);
    expect(root.textContent).toMatch(/4\sMo/);
    expect(root.textContent).toMatch(/16\sMo/);
    expect(root.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('25');
  });

  it('lists the credits and the version', () => {
    const { root } = setup();
    expect(root.textContent).toMatch(/Version \d/);
    expect(root.querySelectorAll('ul li').length).toBeGreaterThan(0);
  });

  it('replays the introduction', () => {
    const { root } = setup();
    const onboarding = TestBed.inject(OnboardingService);
    onboarding.dismiss();
    Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Revoir'))!.click();
    expect(onboarding.opened()).toBe(true);
  });

  it.each([
    ['ready', 'prête'],
    ['none', 'jour'],
    ['unavailable', 'indisponibles'],
  ])('reports a %s check', async (result, text) => {
    updates.check.mockResolvedValue(result);
    const { fixture, root } = setup();
    root.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain(text));
    fixture.detectChanges();
    expect(root.textContent).toContain(text);
  });

  it('reports failures depending on connectivity', async () => {
    updates.check.mockRejectedValue(new Error('x'));
    const { root } = setup();
    root.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain('impossible'));
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    root.querySelector<HTMLButtonElement>('button')!.click();
    await vi.waitFor(() => expect(root.textContent).toContain('Hors ligne'));
    vi.restoreAllMocks();
  });

  it('offers to install an available update', () => {
    available.set(true);
    const { root } = setup();
    root.querySelector<HTMLButtonElement>('button')!.click();
    expect(updates.apply).toHaveBeenCalled();
  });
});
