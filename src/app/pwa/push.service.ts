import { Injectable, effect, inject, signal } from '@angular/core';
import { SwPush } from '@angular/service-worker';

import { RssStore } from '../rss/rss.store';

const URL_KEY = 'rssreader:push-url';

/** Registers this device with the push worker so new articles are notified even when the app is closed. */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly swPush = inject(SwPush, { optional: true });
  private readonly store = inject(RssStore);

  readonly supported = !!this.swPush?.isEnabled && 'PushManager' in window && 'Notification' in window;
  readonly url = signal(localStorage.getItem(URL_KEY) ?? '');
  readonly enabled = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  constructor() {
    if (!this.supported) return;
    this.swPush!.subscription.subscribe((sub) => this.enabled.set(!!sub));
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const urls = this.store.feeds().map((f) => f.url);
      if (!this.enabled() || !this.endpoint()) return;
      clearTimeout(timer);
      timer = setTimeout(() => void this.sync(urls).catch(() => undefined), 1500);
    });
  }

  setUrl(value: string): void {
    this.url.set(value.trim());
    localStorage.setItem(URL_KEY, this.url());
  }

  async enable(): Promise<void> {
    this.error.set('');
    const base = this.endpoint();
    if (!this.supported || !base) {
      this.error.set("Saisissez l'adresse du worker de notifications.");
      return;
    }
    this.busy.set(true);
    try {
      const response = await fetch(`${base}/vapid-key`);
      if (!response.ok) throw new Error(`Worker injoignable (${response.status})`);
      const { publicKey } = (await response.json()) as { publicKey: string };
      const subscription = await this.swPush!.requestSubscription({ serverPublicKey: publicKey });
      await this.post('/subscribe', { subscription: subscription.toJSON(), feeds: this.store.feeds().map((f) => f.url) });
      this.enabled.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Activation impossible.');
      await this.swPush!.unsubscribe().catch(() => undefined);
      this.enabled.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    try {
      const sub = await new Promise<PushSubscription | null>((resolve) => this.swPush!.subscription.subscribe(resolve).unsubscribe());
      if (sub && this.endpoint()) await this.post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
      await this.swPush!.unsubscribe().catch(() => undefined);
      this.enabled.set(false);
    } finally {
      this.busy.set(false);
    }
  }

  private async sync(feeds: string[]): Promise<void> {
    const sub = await new Promise<PushSubscription | null>((resolve) => this.swPush!.subscription.subscribe(resolve).unsubscribe());
    if (sub) await this.post('/subscribe', { subscription: sub.toJSON(), feeds });
  }

  private endpoint(): string {
    try {
      return new URL(this.url()).origin;
    } catch {
      return '';
    }
  }

  private async post(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${this.endpoint()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Worker : erreur ${response.status}`);
  }
}
