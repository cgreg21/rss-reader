import { Injectable, inject, signal } from '@angular/core';

import { FetchService } from './fetch.service';

const CACHE = 'rssreader-media';
const key = (id: string): string => `/offline-media/${encodeURIComponent(id)}`;

/** Podcast / video files saved on the device (Cache API) to be played without network. */
@Injectable({ providedIn: 'root' })
export class OfflineMediaService {
  private readonly net = inject(FetchService);
  readonly supported = typeof caches !== 'undefined';
  /** Object URLs of the saved files, by article id. */
  private readonly urls = signal<Record<string, string>>({});
  /** Download progress (0..1, -1 when the size is unknown) by article id. */
  readonly progress = signal<Record<string, number>>({});
  private loaded: Promise<void> | undefined;

  constructor() {
    if (this.supported) void this.load();
  }

  /** Local URL of the saved file, if any. */
  src(id: string): string | undefined {
    return this.urls()[id];
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      const cache = await caches.open(CACHE);
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

  async download(id: string, url: string): Promise<void> {
    await this.load();
    this.setProgress(id, -1);
    try {
      const response = await this.net.request(url);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      const total = Number(response.headers.get('content-length')) || 0;
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let received = 0;
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array<ArrayBuffer>);
        received += value.length;
        if (total) this.setProgress(id, Math.min(1, received / total));
      }
      const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'audio/mpeg' });
      const cache = await caches.open(CACHE);
      await cache.put(key(id), new Response(blob, { headers: { 'content-type': blob.type } }));
      this.urls.update((u) => ({ ...u, [id]: URL.createObjectURL(blob) }));
      void navigator.storage?.persist?.();
    } finally {
      this.setProgress(id, null);
    }
  }

  async remove(id: string): Promise<void> {
    const cache = await caches.open(CACHE);
    await cache.delete(key(id));
    const url = this.urls()[id];
    if (url) URL.revokeObjectURL(url);
    this.urls.update(({ [id]: _, ...rest }) => rest);
  }

  private setProgress(id: string, value: number | null): void {
    this.progress.update(({ [id]: _, ...rest }) => (value === null ? rest : { ...rest, [id]: value }));
  }
}
