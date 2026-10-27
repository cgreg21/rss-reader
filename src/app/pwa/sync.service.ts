import { Injectable, effect, inject, signal } from '@angular/core';

import { RssStore, SyncDoc, canonicalSyncDoc } from '../rss/rss.store';
import { PushService } from './push.service';

const CODE_KEY = 'rssreader:sync-code';
const PIN_LENGTH = 4;

/** The worker wants a 16+ character secret: the PIN is stretched into one with SHA-256. */
async function tokenFor(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rssreader:${pin}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Keeps feeds, categories and read / favourite / later states in step across devices through the worker's /sync endpoint. */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly store = inject(RssStore);
  private readonly push = inject(PushService);

  readonly code = signal(localStorage.getItem(CODE_KEY) ?? '');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly lastSync = signal<number | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private again = false;

  constructor() {
    effect(() => {
      this.store.feeds();
      this.store.articles();
      this.store.removedFeeds();
      if (!this.enabled()) return;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.sync(), 2000);
    });
    effect(() => {
      const code = this.code();
      if (!this.enabled()) {
        this.push.syncToken.set('');
        return;
      }
      void tokenFor(code).then((token) => this.push.syncToken.set(token));
    });
    // Another device changed the library: pull right away.
    this.push.onSyncMessage(() => void this.sync());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled()) void this.sync();
    });
  }

  enabled(): boolean {
    return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(this.code()) && this.endpoint() !== '';
  }

  setCode(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, PIN_LENGTH));
    localStorage.setItem(CODE_KEY, this.code());
    if (this.enabled()) void this.sync();
  }

  generateCode(): string {
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** PIN_LENGTH).padStart(PIN_LENGTH, '0');
    this.setCode(pin);
    return pin;
  }

  async sync(): Promise<void> {
    if (!this.enabled() || !navigator.onLine) return;
    if (this.busy()) {
      this.again = true;
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.load();
      const feedsBefore = this.store.feeds().length;
      let rev: number | undefined;
      let remote = '';
      const got = await this.call('GET');
      if (got.ok) {
        const doc = (await got.json()) as { rev: number; data: SyncDoc };
        rev = doc.rev;
        remote = canonicalSyncDoc(doc.data);
        await this.store.applySyncDoc(doc.data);
      } else if (got.status !== 404) {
        throw new Error(`Synchronisation : erreur ${got.status}`);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const doc = this.store.buildSyncDoc();
        if (rev !== undefined && canonicalSyncDoc(doc) === remote) break;
        const put = await this.call('PUT', { rev, data: doc, from: this.push.deviceEndpoint() });
        if (put.ok) break;
        if (put.status !== 409) throw new Error(`Synchronisation : erreur ${put.status}`);
        const current = (await put.json()) as { rev: number; data: SyncDoc };
        rev = current.rev;
        remote = canonicalSyncDoc(current.data);
        await this.store.applySyncDoc(current.data);
      }
      this.store.markSynced();
      this.lastSync.set(Date.now());
      if (this.store.feeds().length !== feedsBefore) void this.store.refreshAll();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Synchronisation impossible');
    } finally {
      this.busy.set(false);
      if (this.again) {
        this.again = false;
        void this.sync();
      }
    }
  }

  private endpoint(): string {
    try {
      return new URL(this.store.proxy()).origin;
    } catch {
      return '';
    }
  }

  private async call(method: 'GET' | 'PUT', body?: unknown): Promise<Response> {
    return fetch(`${this.endpoint()}/sync`, {
      method,
      headers: { Authorization: `Bearer ${await tokenFor(this.code())}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
