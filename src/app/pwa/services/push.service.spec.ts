import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwPush } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FeedsStore } from '../../rss/feeds.store';
import { PushService } from './push.service';

describe('PushService', () => {
  const sub$ = new BehaviorSubject<unknown>(null);
  const feeds = signal<{ url: string }[]>([]);
  const swPush = {
    isEnabled: true,
    subscription: sub$,
    requestSubscription: vi.fn(),
    unsubscribe: vi.fn(),
  };
  const fetchMock = vi.fn();
  const fakeSub = { endpoint: 'https://push/e', toJSON: () => ({ endpoint: 'https://push/e' }) };

  const create = (push: unknown = swPush) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SwPush, useValue: push }, { provide: FeedsStore, useValue: { feeds } }] });
    return TestBed.inject(PushService);
  };

  beforeEach(() => {
    localStorage.clear();
    sub$.next(null);
    feeds.set([{ url: 'https://a.com/rss' }]);
    swPush.requestSubscription.mockReset().mockResolvedValue(fakeSub);
    swPush.unsubscribe.mockReset().mockResolvedValue(undefined);
    fetchMock.mockReset().mockResolvedValue(new Response('{"publicKey":"k"}'));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', class {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is unsupported without service worker push', async () => {
    const s = create({ isEnabled: false });
    expect(s.supported).toBe(false);
    await s.enable();
    expect(s.error()).not.toBe('');
    expect(create(null).supported).toBe(false);
  });

  it('stores the worker url and tracks the subscription', () => {
    const s = create();
    s.setUrl(' https://w.com/path ');
    expect(localStorage.getItem('rssreader:push-url')).toBe('https://w.com/path');
    sub$.next(fakeSub);
    expect(s.enabled()).toBe(true);
  });

  it('requires a valid url to enable', async () => {
    const s = create();
    await s.enable();
    expect(s.error()).toContain('adresse');
  });

  it('enables push', async () => {
    const s = create();
    s.setUrl('https://w.com');
    await s.enable();
    expect(fetchMock.mock.calls[1][0]).toBe('https://w.com/subscribe');
    expect(s.enabled()).toBe(true);
    expect(s.busy()).toBe(false);
  });

  it('reports failures from the worker and rolls back', async () => {
    const s = create();
    s.setUrl('https://w.com');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    await s.enable();
    expect(s.error()).toContain('500');
    expect(s.enabled()).toBe(false);

    fetchMock.mockResolvedValueOnce(new Response('{"publicKey":"k"}')).mockResolvedValueOnce(new Response('', { status: 400 }));
    swPush.unsubscribe.mockRejectedValue(new Error('x'));
    await s.enable();
    expect(s.error()).toContain('400');

    swPush.requestSubscription.mockRejectedValueOnce('weird');
    await s.enable();
    expect(s.error()).toBe('Activation impossible.');
  });

  it('disables push, tolerating errors', async () => {
    const s = create();
    s.setUrl('https://w.com');
    sub$.next(fakeSub);
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await s.disable();
    expect(fetchMock.mock.calls[0][0]).toBe('https://w.com/unsubscribe');
    expect(s.enabled()).toBe(false);

    sub$.next(null);
    swPush.unsubscribe.mockRejectedValue(new Error('x'));
    await s.disable();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('syncs the feed list when it changes', async () => {
    vi.useFakeTimers();
    const s = create();
    s.setUrl('https://w.com');
    sub$.next(fakeSub);
    TestBed.tick();
    feeds.set([{ url: 'https://b.com' }]);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchMock).toHaveBeenCalledWith('https://w.com/subscribe', expect.objectContaining({ method: 'POST' }));

    fetchMock.mockClear();
    sub$.next(null);
    s.enabled.set(true);
    feeds.set([]);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(1600);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
