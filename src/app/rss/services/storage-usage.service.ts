import { Injectable } from '@angular/core';

import { MessageKey } from '../../i18n/messages';
import { db } from '../storage/db';
import { IMAGE_CACHE } from './image-cache.service';
import { MEDIA_CACHE } from './offline-media.service';

export interface StorageEntry {
  key: MessageKey;
  bytes: number;
}

export interface StorageUsage {
  entries: StorageEntry[];
  /** Everything the origin uses as reported by the browser (includes the app shell), or the sum of the entries. */
  used: number;
  /** 0 when the browser does not report it. */
  quota: number;
}

const jsonBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

async function cacheBytes(name: string): Promise<number> {
  if (!('caches' in globalThis) || !(await caches.has(name))) return 0;
  const cache = await caches.open(name);
  let total = 0;
  for (const request of await cache.keys()) {
    const response = await cache.match(request);
    if (!response) continue;
    const length = Number(response.headers.get('content-length'));
    total += length > 0 ? length : (await response.blob()).size;
  }
  return total;
}

function settingsBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.startsWith('rssreader:')) total += jsonBytes(key) + jsonBytes(localStorage.getItem(key));
  }
  return total;
}

/** Sizes of what the app keeps on the device, by kind. */
@Injectable({ providedIn: 'root' })
export class StorageUsageService {
  async measure(): Promise<StorageUsage> {
    const [articles, feeds, categories, images, media] = await Promise.all([
      db.all('articles'), db.all('feeds'), db.all('categories'), cacheBytes(IMAGE_CACHE), cacheBytes(MEDIA_CACHE),
    ]);
    const entries: StorageEntry[] = [
      { key: 'storage.articles', bytes: jsonBytes(articles) },
      { key: 'storage.feeds', bytes: jsonBytes(feeds) + jsonBytes(categories) },
      { key: 'storage.images', bytes: images },
      { key: 'storage.media', bytes: media },
      { key: 'storage.settings', bytes: settingsBytes() },
    ];
    const sum = entries.reduce((n, e) => n + e.bytes, 0);
    const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
    return { entries, used: Math.max(sum, estimate?.usage ?? 0), quota: estimate?.quota ?? 0 };
  }
}
