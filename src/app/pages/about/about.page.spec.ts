import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateService } from '../../pwa/services/update.service';
import { AboutPage } from './about.page';

describe('AboutPage', () => {
  const available = signal(false);
  const updates = { available, apply: vi.fn(), check: vi.fn() };

  beforeEach(() => {
    available.set(false);
    updates.apply.mockReset();
    updates.check.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: UpdateService, useValue: updates }] });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(AboutPage);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('lists the credits and the version', () => {
    const { root } = setup();
    expect(root.textContent).toMatch(/Version \d/);
    expect(root.querySelectorAll('ul li').length).toBeGreaterThan(0);
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
