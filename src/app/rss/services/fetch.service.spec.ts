import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsStore } from '../settings.store';
import { FetchService } from './fetch.service';

describe('FetchService', () => {
  const fetchMock = vi.fn();
  let service: FetchService;
  let settings: SettingsStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    settings = TestBed.inject(SettingsStore);
    service = TestBed.inject(FetchService);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches directly without a proxy', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await service.request('https://a.com/x');
    expect(fetchMock).toHaveBeenCalledWith('https://a.com/x');
  });

  it('goes through the proxy when enabled', async () => {
    settings.setProxy('https://proxy.com');
    fetchMock.mockResolvedValue(new Response('ok'));
    await service.request('https://a.com/x?y=1');
    expect(fetchMock).toHaveBeenCalledWith('https://proxy.com/x?y=1', { credentials: 'omit', headers: { 'X-Upstream': 'https://a.com' } });
  });

  it('downloads text and throws on HTTP errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response('hello'));
    expect(await service.download('https://a.com')).toBe('hello');
    fetchMock.mockResolvedValueOnce(new Response('', { status: 404 }));
    await expect(service.download('https://a.com')).rejects.toThrow('HTTP 404');
  });

  it('searches feeds and filters results', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ results: [{ feedId: 'feed/https://a.com/rss', title: 'A', website: 'w', subscribers: 3 }, { feedId: 'feed/https://b.com' }, { feedId: 'other' }, {}] })),
    );
    const hits = await service.searchFeeds(' q r ');
    expect(fetchMock.mock.calls[0][0]).toContain('query=q%20r');
    expect(hits.map((h) => [h.url, h.title])).toEqual([['https://a.com/rss', 'A'], ['https://b.com', 'https://b.com']]);
    fetchMock.mockResolvedValueOnce(new Response('{}'));
    expect(await service.searchFeeds('x')).toEqual([]);
  });
});
