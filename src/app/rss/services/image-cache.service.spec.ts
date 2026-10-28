import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsStore } from '../settings.store';
import { FetchService } from './fetch.service';
import { ImageCache } from './image-cache.service';

class FakeCache {
  store = new Map<string, Response>();
  match = async (url: string) => this.store.get(url);
  put = async (url: string, r: Response) => void this.store.set(url, r);
  keys = async () => [...this.store.keys()];
  delete = async (url: string) => this.store.delete(url);
}

describe('ImageCache', () => {
  let cache: FakeCache;
  let cache$: ImageCache;
  const request = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    cache = new FakeCache();
    request.mockReset();
    request.mockImplementation(async () => new Response('img'));
    vi.stubGlobal('caches', { open: async () => cache, delete: vi.fn(async () => true) });
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: FetchService, useValue: { request } }] });
    TestBed.inject(SettingsStore).setProxy('https://proxy.com');
    cache$ = TestBed.inject(ImageCache);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns the original url without proxy or for non-http urls', async () => {
    expect(await cache$.url('data:image/png;base64,AA')).toBe('data:image/png;base64,AA');
    TestBed.inject(SettingsStore).proxyEnabled.set(false);
    expect(await cache$.url('https://a.com/i.png')).toBe('https://a.com/i.png');
  });

  it('loads through the network once and memoises', async () => {
    expect(await cache$.url('https://a.com/i.png')).toBe('blob:x');
    expect(await cache$.url('https://a.com/i.png')).toBe('blob:x');
    expect(request).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(cache$.count()).toBe(1));
  });

  it('uses a cached response and evicts the oldest beyond the limit', async () => {
    cache.store.set('https://a.com/c.png', new Response('c'));
    await cache$.url('https://a.com/c.png');
    expect(request).not.toHaveBeenCalled();
    for (let i = 0; i < 301; i++) cache.store.set(`https://a.com/${i}`, new Response('x'));
    await cache$.url('https://a.com/new.png');
    expect(cache.store.size).toBe(300);
  });

  it('falls back to the url on failure and retries later', async () => {
    request.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await cache$.url('https://a.com/bad.png')).toBe('https://a.com/bad.png');
    expect(await cache$.url('https://a.com/bad.png')).toBe('blob:x');
  });

  it('counts and clears', async () => {
    await cache$.url('https://a.com/i.png');
    await cache$.refreshCount();
    expect(cache$.count()).toBe(1);
    await cache$.clear();
    expect(cache$.count()).toBe(0);
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x'));
  });

  it('works without the Cache API', async () => {
    vi.stubGlobal('caches', undefined);
    delete (globalThis as { caches?: unknown }).caches;
    expect(await cache$.url('https://a.com/n.png')).toBe('blob:x');
    await cache$.refreshCount();
    expect(cache$.count()).toBe(0);
    await cache$.clear();
  });
});
