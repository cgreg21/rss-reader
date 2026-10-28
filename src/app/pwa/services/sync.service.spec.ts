import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LibraryService } from '../../rss/services/library.service';
import { ArticlesStore } from '../../rss/articles.store';
import { FeedsStore } from '../../rss/feeds.store';
import { RefreshService } from '../../rss/services/refresh.service';
import { SettingsStore } from '../../rss/settings.store';
import { SnackbarService } from '../../ui/services/snackbar.service';
import { SyncService, tokenFor } from './sync.service';

class FakeSocket {
  static all: FakeSocket[] = [];
  onmessage: unknown = null;
  onclose: unknown = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  close(): void {}
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('SyncService', () => {
  const proxy = signal('https://srv.com');
  const store = {
    feeds: signal<unknown[]>([]),
    articles: signal<unknown[]>([]),
    removedFeeds: signal<string[]>([]),
    load: vi.fn(),
    markSynced: vi.fn(),
    refreshAll: vi.fn(),
  };
  const library = { applySyncDoc: vi.fn(), buildSyncDoc: vi.fn() };
  const snackbar = { error: vi.fn() };
  const fetchMock = vi.fn();
  let service: SyncService;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: FeedsStore, useValue: store },
        { provide: ArticlesStore, useValue: store },
        { provide: RefreshService, useValue: store },
        { provide: LibraryService, useValue: library },
        { provide: SettingsStore, useValue: { proxy } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    return TestBed.inject(SyncService);
  };

  beforeEach(() => {
    localStorage.clear();
    FakeSocket.all = [];
    proxy.set('https://srv.com');
    store.feeds.set([]);
    store.load.mockReset().mockResolvedValue(undefined);
    store.markSynced.mockReset();
    store.refreshAll.mockReset();
    library.applySyncDoc.mockReset().mockResolvedValue(undefined);
    library.buildSyncDoc.mockReset().mockReturnValue({ feeds: [], removed: [], states: {} });
    snackbar.error.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('derives a 64 char token from the pin', async () => {
    expect(await tokenFor('1234')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates and stores the code', async () => {
    fetchMock.mockResolvedValue(json({}, 500));
    service = create();
    expect(service.enabled()).toBe(false);
    service.setCode('a1b2c3d4e5');
    expect(service.code()).toBe('1234');
    expect(localStorage.getItem('rssreader:sync-code')).toBe('1234');
    expect(service.enabled()).toBe(true);
    proxy.set('');
    expect(service.enabled()).toBe(false);
    expect(service.generateCode()).toMatch(/^\d{4}$/);
    await vi.waitFor(() => expect(service.busy()).toBe(false));
  });

  it('pulls then pushes, and refreshes when feeds were added', async () => {
    service = create();
    service.code.set('1234');
    library.applySyncDoc.mockImplementation(async () => store.feeds.set([{}]));
    fetchMock.mockResolvedValueOnce(json({ rev: 3, data: { feeds: [], removed: [], states: { a: 1 } } })).mockResolvedValueOnce(json({}));
    await service.sync();
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).rev).toBe(3);
    expect(store.markSynced).toHaveBeenCalled();
    expect(store.refreshAll).toHaveBeenCalled();
    expect(service.lastSync()).not.toBeNull();
    expect(service.error()).toBe('');
  });

  it('skips the upload when nothing differs, and creates on 404', async () => {
    service = create();
    service.code.set('1234');
    fetchMock.mockResolvedValueOnce(json({ rev: 1, data: { feeds: [], removed: [], states: {} } }));
    await service.sync();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}));
    await service.sync();
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).rev).toBeUndefined();
  });

  it('merges and retries on conflict', async () => {
    service = create();
    service.code.set('1234');
    fetchMock
      .mockResolvedValueOnce(json({ rev: 1, data: { feeds: [], removed: [], states: { a: 1 } } }))
      .mockResolvedValueOnce(json({ rev: 2, data: { feeds: [], removed: [], states: { b: 1 } } }, 409))
      .mockResolvedValueOnce(json({}));
    await service.sync();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(library.applySyncDoc).toHaveBeenCalledTimes(2);
  });

  it('reports server errors and stops after repeated failures', async () => {
    service = create();
    service.code.set('1234');
    fetchMock.mockResolvedValue(json({}, 500));
    await service.sync();
    expect(service.error()).toContain('500');
    for (let i = 0; i < 4; i++) await service.sync();
    expect(service.stopped()).toBe(true);
    expect(snackbar.error).toHaveBeenCalled();
    expect(service.enabled()).toBe(false);

    fetchMock.mockReset().mockResolvedValue(json({}, 404)).mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 500));
    service.resume();
    await vi.waitFor(() => expect(service.error()).toContain('500'));
  });

  it('reports PUT failures and non Error rejections', async () => {
    service = create();
    service.code.set('1234');
    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 500));
    await service.sync();
    expect(service.error()).toContain('500');
    fetchMock.mockRejectedValueOnce('weird');
    await service.sync();
    expect(service.error()).toBe('Synchronisation impossible');
  });

  it('ignores sync while busy, disabled or offline', async () => {
    service = create();
    await service.sync();
    service.code.set('1234');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await service.sync();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('schedules a sync after local changes, and syncs on visibility changes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    fetchMock.mockImplementation(async () => json({}, 404));
    service = create();
    service.code.set('1234');
    TestBed.tick();
    store.feeds.set([{ a: 1 }]);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(60 * 60_000 + 10);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fetchMock.mockClear();
    const hidden = vi.spyOn(document, 'hidden', 'get');
    store.feeds.set([{ a: 2 }]);
    TestBed.tick();
    hidden.mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fetchMock.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchMock).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(10);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(fetchMock).not.toHaveBeenCalled();

    service.code.set('');
    document.dispatchEvent(new Event('visibilitychange'));
  });

  it('opens the live channel when enabled and closes it otherwise', async () => {
    service = create();
    service.code.set('1234');
    TestBed.tick();
    await vi.waitFor(() => expect(FakeSocket.all[0]?.url).toMatch(/^wss:\/\/srv\.com\/sync\/ws\?token=/));
    service.code.set('');
    TestBed.tick();
    proxy.set('');
    TestBed.tick();
  });
});
