import { Injectable, effect, inject, signal } from '@angular/core';

import { RssStore, SyncDoc } from '../rss/rss.store';
import { SnackbarService } from '../ui/snackbar.service';

const CODE_KEY = 'rssreader:sync-code';
const PIN_LENGTH = 4;
const MAX_FAILURES = 5;
/** Local changes are uploaded at most once an hour (or when the app is hidden). */
const SYNC_INTERVAL_MS = 60 * 60_000;

/** The worker wants a 16+ character secret: the PIN is stretched into one with SHA-256. */
async function tokenFor(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rssreader:${pin}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Keeps feeds, categories and read / favourite / later states in step across devices through the worker's /sync endpoint. */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly store = inject(RssStore);
  private readonly snackbar = inject(SnackbarService);
  private failures = 0;
  /** Set after repeated failures: automatic syncs stop until the user retries by hand. */
  readonly stopped = signal(false);

  readonly code = signal(localStorage.getItem(CODE_KEY) ?? '');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly lastSync = signal<number | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private socket: WebSocket | undefined;
  private socketKey = '';
  private retry: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      this.code();
      this.stopped();
      this.store.proxy();
      void this.connect();
    });
    effect(() => {
      this.store.feeds();
      this.store.articles();
      this.store.removedFeeds();
      if (!this.enabled()) return;
      this.dirty = true;
      this.timer ??= setTimeout(() => void this.sync(), SYNC_INTERVAL_MS);
    });
    document.addEventListener('visibilitychange', () => {
      if (!this.enabled()) return;
      if (document.hidden) {
        if (this.dirty) void this.sync();
      } else if (Date.now() - (this.lastSync() ?? 0) > SYNC_INTERVAL_MS) {
        void this.sync();
      }
    });
  }

  enabled(): boolean {
    return !this.stopped() && this.configured();
  }

  private configured(): boolean {
    return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(this.code()) && this.endpoint() !== '';
  }

  /** Manual retry: clears the failure stop, then syncs. */
  resume(): void {
    this.failures = 0;
    this.stopped.set(false);
    void this.sync();
  }

  setCode(value: string): void {
    this.code.set(value.replace(/\D/g, '').slice(0, PIN_LENGTH));
    localStorage.setItem(CODE_KEY, this.code());
    this.failures = 0;
    this.stopped.set(false);
    if (this.enabled()) void this.sync();
  }

  generateCode(): string {
    const pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** PIN_LENGTH).padStart(PIN_LENGTH, '0');
    this.setCode(pin);
    return pin;
  }

  async sync(): Promise<void> {
    if (this.busy() || !this.enabled() || !navigator.onLine) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.dirty = false;
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
        remote = JSON.stringify(doc.data);
        await this.store.applySyncDoc(doc.data);
      } else if (got.status !== 404) {
        throw new Error(`Synchronisation : erreur ${got.status}`);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const local = JSON.stringify(this.store.buildSyncDoc());
        if (rev !== undefined && local === remote) break;
        const put = await this.call('PUT', { rev, data: JSON.parse(local) });
        if (put.ok) break;
        if (put.status !== 409) throw new Error(`Synchronisation : erreur ${put.status}`);
        const current = (await put.json()) as { rev: number; data: SyncDoc };
        rev = current.rev;
        remote = JSON.stringify(current.data);
        await this.store.applySyncDoc(current.data);
      }
      this.store.markSynced();
      this.lastSync.set(Date.now());
      this.failures = 0;
      if (this.store.feeds().length !== feedsBefore) void this.store.refreshAll();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Synchronisation impossible');
      if (++this.failures >= MAX_FAILURES) {
        this.stopped.set(true);
        this.socket?.close();
        this.snackbar.error('Synchronisation arrêtée après 5 échecs. Relancez-la depuis les options.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Live channel: the worker says "changed" when another device saved, then we pull. */
  private async connect(): Promise<void> {
    const enabled = this.enabled();
    const key = enabled ? `${this.endpoint()}|${this.code()}` : '';
    if (key === this.socketKey && (!enabled || this.socket)) return;
    this.socketKey = key;
    clearTimeout(this.retry);
    this.socket?.close();
    this.socket = undefined;
    if (!enabled) return;
    const token = await tokenFor(this.code());
    if (this.socketKey !== key) return;
    const url = `${this.endpoint().replace(/^http/, 'ws')}/sync/ws?token=${token}`;
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onmessage = (event) => {
      if (event.data === 'changed') void this.sync();
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.retry = setTimeout(() => void this.connect(), 5000);
    };
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
