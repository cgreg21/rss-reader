import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

/**
 * Brings a new deployment in: the worker downloads it in the background, the user is told it is
 * ready and can apply it, and the page reloads by itself the next time it comes back to the foreground.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly readyState = signal(false);
  /** A new version is downloaded and waits for a reload. */
  readonly available = this.readyState.asReadonly();
  readonly dismissed = signal(false);

  constructor() {
    const updates = this.updates;
    if (!updates?.isEnabled) return;
    updates.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.readyState.set(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (this.readyState()) this.apply();
      else void updates.checkForUpdate().catch(() => undefined);
    });
  }

  apply(): void {
    location.reload();
  }

  dismiss(): void {
    this.dismissed.set(true);
  }
}
