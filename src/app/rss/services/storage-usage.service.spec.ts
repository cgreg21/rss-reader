import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../storage/db';
import { StorageUsageService } from './storage-usage.service';

describe('StorageUsageService', () => {
  let service: StorageUsageService;

  beforeEach(async () => {
    localStorage.clear();
    for (const r of await db.all<{ id: string }>('articles')) await db.remove('articles', r.id);
    service = TestBed.inject(StorageUsageService);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sizes the database, settings and caches, with the browser estimate', async () => {
    await db.put('articles', { id: 'a', title: 'é' });
    localStorage.setItem('rssreader:x', '12');
    localStorage.setItem('other', 'ignored');
    const cache = { keys: vi.fn().mockResolvedValue([1, 2, 3]), match: vi.fn()
      .mockResolvedValueOnce(new Response('abcd', { headers: { 'content-length': '40' } }))
      .mockResolvedValueOnce(new Response('abcd'))
      .mockResolvedValueOnce(undefined) };
    vi.stubGlobal('caches', { has: vi.fn().mockImplementation(async (n: string) => n === 'rss-images'), open: vi.fn().mockResolvedValue(cache) });
    vi.stubGlobal('navigator', { ...navigator, storage: { estimate: vi.fn().mockResolvedValue({ usage: 5000, quota: 10_000 }) } });
    const usage = await service.measure();
    const bytes = Object.fromEntries(usage.entries.map((e) => [e.key, e.bytes]));
    expect(bytes['storage.articles']).toBe(new TextEncoder().encode(JSON.stringify([{ id: 'a', title: 'é' }])).length);
    expect(bytes['storage.images']).toBe(44);
    expect(bytes['storage.media']).toBe(0);
    expect(bytes['storage.settings']).toBe('"rssreader:x"'.length + '"12"'.length);
    expect(usage.used).toBe(5000);
    expect(usage.quota).toBe(10_000);
  });

  it('falls back to the sum without caches or estimate', async () => {
    vi.stubGlobal('navigator', { ...navigator, storage: undefined });
    const usage = await service.measure();
    expect(usage.quota).toBe(0);
    expect(usage.used).toBe(usage.entries.reduce((n, e) => n + e.bytes, 0));
  });
});
