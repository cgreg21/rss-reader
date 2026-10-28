import { Injectable, inject, signal } from '@angular/core';

import { FetchService } from './fetch.service';

export const IMAGE_CACHE = 'rss-images';
const MAX_CACHED_IMAGES = 300;

/** Images fetched through the proxy as blobs, persisted in the Cache API. */
@Injectable({ providedIn: 'root' })
export class ImageCache {
  private readonly net = inject(FetchService);
  private readonly images = new Map<string, Promise<string>>();
  readonly count = signal(0);

  /** URL to display for an image: a blob persisted in the Cache API (falls back to the original URL if it cannot be fetched). */
  url(url: string): Promise<string> {
    if (!/^https?:/i.test(url)) return Promise.resolve(url);
    let blob = this.images.get(url);
    if (!blob) {
      blob = this.load(url).catch(() => {
        this.images.delete(url);
        return url;
      });
      this.images.set(url, blob);
    }
    return blob;
  }

  async refreshCount(): Promise<void> {
    this.count.set('caches' in globalThis ? (await (await caches.open(IMAGE_CACHE)).keys()).length : 0);
  }

  async clear(): Promise<void> {
    for (const blob of this.images.values()) void blob.then((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
    this.images.clear();
    if ('caches' in globalThis) await caches.delete(IMAGE_CACHE);
    this.count.set(0);
  }

  private async load(url: string): Promise<string> {
    const cache = 'caches' in globalThis ? await caches.open(IMAGE_CACHE) : null;
    let response = (await cache?.match(url)) ?? null;
    if (!response) {
      response = await this.net.request(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (cache) {
        await cache.put(url, response.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_IMAGES))) await cache.delete(old);
        void this.refreshCount();
      }
    }
    return URL.createObjectURL(await response.blob());
  }
}
