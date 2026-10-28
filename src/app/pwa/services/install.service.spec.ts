import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InstallService } from './install.service';

const promptEvent = (outcome = 'accepted') => {
  const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
  e.prompt = vi.fn(async () => undefined);
  e.userChoice = Promise.resolve({ outcome });
  return e;
};

describe('InstallService', () => {
  const setup = (standalone = false) => {
    vi.stubGlobal('matchMedia', () => ({ matches: standalone }));
    TestBed.resetTestingModule();
    return TestBed.inject(InstallService);
  };
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('captures the prompt and installs once', async () => {
    const s = setup();
    const e = promptEvent();
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(s.canInstall()).toBe(true);
    expect(s.banner()).toBe(true);
    await s.install();
    expect(e.prompt).toHaveBeenCalled();
    expect(s.canInstall()).toBe(false);
    expect(localStorage.getItem('rssreader:install-dismissed')).toBe('1');
    await s.install();
    expect(e.prompt).toHaveBeenCalledTimes(1);
  });

  it('does not show the banner after dismissal and resets on appinstalled', () => {
    localStorage.setItem('rssreader:install-dismissed', '1');
    const s = setup();
    window.dispatchEvent(promptEvent());
    expect(s.canInstall()).toBe(true);
    expect(s.banner()).toBe(false);
    s.banner.set(true);
    window.dispatchEvent(new Event('appinstalled'));
    expect(s.canInstall()).toBe(false);
    expect(s.banner()).toBe(false);
  });

  it('dismisses, even when storage fails', () => {
    const s = setup();
    s.banner.set(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    s.dismiss();
    expect(s.banner()).toBe(false);
    vi.restoreAllMocks();
  });

  it('stays inert when already installed', () => {
    const s = setup(true);
    window.dispatchEvent(promptEvent());
    expect(s.canInstall()).toBe(false);
  });

  it('detects iOS standalone', () => {
    vi.stubGlobal('navigator', { ...navigator, standalone: true });
    const s = setup();
    window.dispatchEvent(promptEvent());
    expect(s.canInstall()).toBe(false);
  });
});
