import { Injectable, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'rssreader:install-dismissed';

/**
 * Captures the browser's install prompt so the app can offer installation at its own pace.
 * `banner` drives the one-time suggestion; `canInstall` stays true so Settings can still offer it.
 */
@Injectable({ providedIn: 'root' })
export class InstallService {
  private deferred: BeforeInstallPromptEvent | null = null;
  readonly canInstall = signal(false);
  readonly banner = signal(false);

  constructor() {
    if (this.isStandalone()) return;
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.deferred = event as BeforeInstallPromptEvent;
      this.canInstall.set(true);
      this.banner.set(!this.dismissed());
    });
    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.canInstall.set(false);
      this.banner.set(false);
    });
  }

  async install(): Promise<void> {
    const event = this.deferred;
    this.banner.set(false);
    if (!event) return;
    this.deferred = null;
    this.canInstall.set(false);
    await event.prompt();
    await event.userChoice;
    this.rememberDismissal();
  }

  /** Hides the suggestion for good; installation remains available from Settings. */
  dismiss(): void {
    this.banner.set(false);
    this.rememberDismissal();
  }

  private isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  }

  private dismissed(): boolean {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  }

  private rememberDismissal(): void {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Storage unavailable: the banner simply shows again next time.
    }
  }
}
