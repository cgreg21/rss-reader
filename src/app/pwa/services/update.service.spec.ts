import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UpdateService } from './update.service';

describe('UpdateService', () => {
  const events = new Subject<{ type: string }>();
  const swUpdate = { isEnabled: true, versionUpdates: events, checkForUpdate: vi.fn() };
  const create = (provide: unknown = swUpdate) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SwUpdate, useValue: provide }] });
    return TestBed.inject(UpdateService);
  };
  const visibility = (state: 'visible' | 'hidden') => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
    document.dispatchEvent(new Event('visibilitychange'));
  };
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    swUpdate.checkForUpdate.mockReset().mockResolvedValue(false);
    reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('is unavailable without a service worker', async () => {
    const s = create({ isEnabled: false });
    expect(await s.check()).toBe('unavailable');
    expect(s.available()).toBe(false);
  });

  it('flags a ready version and ignores other events', () => {
    const s = create();
    events.next({ type: 'VERSION_DETECTED' });
    expect(s.available()).toBe(false);
    events.next({ type: 'VERSION_READY' });
    expect(s.available()).toBe(true);
  });

  it('checks on foreground, then reloads once a version is ready', async () => {
    const s = create();
    visibility('hidden');
    expect(swUpdate.checkForUpdate).not.toHaveBeenCalled();
    visibility('visible');
    expect(swUpdate.checkForUpdate).toHaveBeenCalledTimes(1);
    swUpdate.checkForUpdate.mockRejectedValueOnce(new Error('x'));
    visibility('visible');
    events.next({ type: 'VERSION_READY' });
    visibility('visible');
    expect(reload).toHaveBeenCalled();
    expect(s.available()).toBe(true);
  });

  it('checks manually', async () => {
    const s = create();
    expect(await s.check()).toBe('none');
    swUpdate.checkForUpdate.mockResolvedValue(true);
    expect(await s.check()).toBe('ready');
    expect(await s.check()).toBe('ready');
  });

  it('dismisses', () => {
    const s = create();
    s.dismiss();
    expect(s.dismissed()).toBe(true);
  });
});
