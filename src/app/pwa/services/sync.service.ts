import { Injectable, effect, inject, signal } from '@angular/core';

import { LibraryService, SyncDoc } from '../../rss/services/library.service';
import { ArticlesStore } from '../../rss/articles.store';
import { FeedsStore } from '../../rss/feeds.store';
import { RefreshService } from '../../rss/services/refresh.service';
import { SettingsStore, proxyOrigin } from '../../rss/settings.store';
import { SnackbarService } from '../../ui/services/snackbar.service';
import { LiveChannel } from '../live-channel';

const CODE_KEY = 'rssreader:sync-code';
const PIN_LENGTH = 4;
const MAX_FAILURES = 5;
/** Local changes are uploaded at most once an hour (or when the app is hidden). */
const SYNC_INTERVAL_MS = 60 * 60_000;

/** The server wants a 16+ character secret: the PIN is stretched into one with SHA-256. */
export async function tokenFor(pin: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`rssreader:${pin}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Keeps feeds, categories and read / favourite / later states in step across devices through the server's /sync endpoint. */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly feedsStore = inject(FeedsStore);
  private readonly articlesStore = inject(ArticlesStore);
  private readonly refresh = inject(RefreshService);
  private readonly library = inject(LibraryService);
  private readonly settings = inject(SettingsStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly live = new LiveChannel(() => void this.sync());

  readonly code = signal(localStorage.getItem(CODE_KEY) ?? '');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly lastSync = signal<number | null>(null);
  /** Set after repeated failures: automatic syncs stop until the user retries by hand. */
  readonly stopped = signal(false);

  private failures = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;

  constructor() {
    effect(() => {
      const code = this.code();
      const endpoint = this.enabled() ? this.endpoint() : '';
      if (!endpoint) return this.live.close();
      void tokenFor(code).then((token) => {
        if (this.code() === code && this.enabled()) this.live.open(`${endpoint.replace(/^http/, 'ws')}/sync/ws?token=${token}`);
      });
    });
    effect(() => {
      this.feedsStore.feeds();
      this.articlesStore.articles();
      this.feedsStore.removedFeeds();
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
    return !this.stopped() && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(this.code()) && this.endpoint() !== '';
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
    this.resume();
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
      await this.refresh.load();
      const feedsBefore = this.feedsStore.feeds().length;
      let rev: number | undefined;
      let remote = '';
      const got = await this.call('GET');
      if (got.ok) {
        const doc = (await got.json()) as { rev: number; data: SyncDoc };
        rev = doc.rev;
        remote = JSON.stringify(doc.data);
        await this.library.applySyncDoc(doc.data);
      } else if (got.status !== 404) {
        throw new Error(`Synchronisation : erreur ${got.status}`);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        const local = JSON.stringify(this.library.buildSyncDoc());
        if (rev !== undefined && local === remote) break;
        const put = await this.call('PUT', { rev, data: JSON.parse(local) });
        if (put.ok) break;
        if (put.status !== 409) throw new Error(`Synchronisation : erreur ${put.status}`);
        const current = (await put.json()) as { rev: number; data: SyncDoc };
        rev = current.rev;
        remote = JSON.stringify(current.data);
        await this.library.applySyncDoc(current.data);
      }
      this.feedsStore.markSynced();
      this.lastSync.set(Date.now());
      this.failures = 0;
      if (this.feedsStore.feeds().length !== feedsBefore) void this.refresh.refreshAll();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Synchronisation impossible');
      if (++this.failures >= MAX_FAILURES) {
        this.stopped.set(true);
        this.snackbar.error('Synchronisation arrêtée après 5 échecs. Relancez-la depuis les options.');
      }
    } finally {
      this.busy.set(false);
    }
  }

  private endpoint(): string {
    return proxyOrigin(this.settings.proxy());
  }

  private async call(method: 'GET' | 'PUT', body?: unknown): Promise<Response> {
    return fetch(`${this.endpoint()}/sync`, {
      method,
      headers: { Authorization: `Bearer ${await tokenFor(this.code())}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
