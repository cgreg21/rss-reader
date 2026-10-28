import { Injectable, computed, inject, signal } from '@angular/core';

import { FetchService } from './fetch.service';
import { SettingsStore } from '../stores/settings.store';

export const MEDIA_CACHE = 'rssreader-media';
const key = (id: string): string => `/offline-media/${encodeURIComponent(id)}`;
const RECENT_MS = 7 * 86_400_000;
const AUTO_PER_BATCH = 3;

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  status: 'waiting' | 'downloading' | 'error';
  /** 0..1, or -1 when the size is unknown. */
  progress: number;
  /** Failure cause shown next to the retry button. */
  error?: string;
}

/** Podcast / video files saved on the device (Cache API): background download queue and offline playback. */
@Injectable({ providedIn: 'root' })
export class OfflineMediaService {
  private readonly net = inject(FetchService);
  private readonly settings = inject(SettingsStore);
  readonly supported = typeof caches !== 'undefined';
  /** Object URLs of the saved files, by article id. */
  private readonly urls = signal<Record<string, string>>({});
  /** Items waiting, downloading or failed; finished ones are removed. */
  readonly queue = signal<DownloadItem[]>([]);
  /** Number of items not finished yet (waiting or downloading). */
  readonly pending = computed(() => this.queue().filter((i) => i.status !== 'error').length);
  /** Overall progress of the current download, for the progress bar. */
  readonly currentProgress = computed(() => this.queue().find((i) => i.status === 'downloading')?.progress ?? -1);
  private loaded: Promise<void> | undefined;
  private running = false;
  private controller: AbortController | undefined;

  constructor() {
    if (this.supported) void this.load();
  }

  /** Local URL of the saved file, if any. */
  src(id: string): string | undefined {
    return this.urls()[id];
  }

  item(id: string): DownloadItem | undefined {
    return this.queue().find((i) => i.id === id);
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      const cache = await caches.open(MEDIA_CACHE);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        if (!response) continue;
        const id = decodeURIComponent(new URL(request.url).pathname.slice('/offline-media/'.length));
        const url = URL.createObjectURL(await response.blob());
        this.urls.update((u) => ({ ...u, [id]: url }));
      }
    })();
    return this.loaded;
  }

  /** Adds a file to the download queue (ignored when already saved or queued; a failed one is retried). */
  enqueue(id: string, url: string, title: string): void {
    if (!this.supported || this.urls()[id]) return;
    const existing = this.item(id);
    if (existing && existing.status !== 'error') return;
    const item: DownloadItem = { id, url, title, status: 'waiting', progress: 0 };
    this.queue.update((q) => [...q.filter((i) => i.id !== id), item]);
    void this.run();
  }

  /** Queues the recent audio files of newly fetched articles when automatic download is on. */
  autoEnqueue(articles: { id: string; title: string; published: number; media?: { kind: string; url: string } }[]): void {
    if (!this.settings.autoDownloadPodcasts()) return;
    const limit = Date.now() - RECENT_MS;
    articles
      .filter((a) => a.media?.kind === 'audio' && a.published >= limit)
      .sort((a, b) => b.published - a.published)
      .slice(0, AUTO_PER_BATCH)
      .forEach((a) => this.enqueue(a.id, a.media!.url, a.title));
  }

  /** Removes an item from the queue, cancelling its download when it is the running one. */
  dismiss(id: string): void {
    if (this.item(id)?.status === 'downloading') this.controller?.abort();
    this.queue.update((q) => q.filter((i) => i.id !== id));
  }

  private async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.load();
      for (let next = this.nextWaiting(); next; next = this.nextWaiting()) {
        this.patch(next.id, { status: 'downloading', progress: -1 });
        this.controller = new AbortController();
        try {
          await this.fetchToCache(next);
          this.queue.update((q) => q.filter((i) => i.id !== next.id));
        } catch (e) {
          const error = e instanceof DOMException && e.name === 'QuotaExceededError' ? 'storage full' : e instanceof Error ? e.message : '';
          if (this.item(next.id)) this.patch(next.id, { status: 'error', error });
        }
      }
    } finally {
      this.running = false;
    }
  }

  private nextWaiting(): DownloadItem | undefined {
    return this.queue().find((i) => i.status === 'waiting');
  }

  private patch(id: string, changes: Partial<DownloadItem>): void {
    this.queue.update((q) => q.map((i) => (i.id === id ? { ...i, ...changes } : i)));
  }

  /** Tries the proxy first (when enabled) then a direct request, to cope with CORS and redirects. */
  private async open(url: string): Promise<Response> {
    const signal = this.controller?.signal;
    const attempts = this.settings.activeProxy() ? [this.net.request, this.net.direct] : [this.net.direct];
    let failure = new Error('network');
    for (const attempt of attempts) {
      try {
        const response = await attempt.call(this.net, url, signal);
        if (response.ok && response.body) return response;
        failure = new Error(`HTTP ${response.status}`);
      } catch (e) {
        if (signal?.aborted) throw e;
        failure = new Error('CORS / network');
      }
    }
    throw failure;
  }

  private async fetchToCache(item: DownloadItem): Promise<void> {
    const response = await this.open(item.url);
    const total = Number(response.headers.get('content-length')) || 0;
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    const reader = response.body!.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as Uint8Array<ArrayBuffer>);
      received += value.length;
      if (total && this.item(item.id)) this.patch(item.id, { progress: Math.min(1, received / total) });
    }
    if (!this.item(item.id)) return;
    const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'audio/mpeg' });
    const cache = await caches.open(MEDIA_CACHE);
    await cache.put(key(item.id), new Response(blob, { headers: { 'content-type': blob.type } }));
    const url = URL.createObjectURL(blob);
    this.urls.update((u) => ({ ...u, [item.id]: url }));
    void navigator.storage?.persist?.();
  }

  async remove(id: string): Promise<void> {
    const cache = await caches.open(MEDIA_CACHE);
    await cache.delete(key(id));
    const url = this.urls()[id];
    if (url) URL.revokeObjectURL(url);
    this.urls.update(({ [id]: _, ...rest }) => rest);
  }
}
