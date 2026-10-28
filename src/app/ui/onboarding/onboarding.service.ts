import { Injectable, signal } from '@angular/core';

import { flag, persisted } from '../../rss/storage/persisted';

/** First-launch presentation carousel: shown once, can be replayed from the options. */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private readonly seen = persisted('rssreader:onboarded', flag(false));
  readonly opened = signal(!this.seen());

  show(): void {
    this.opened.set(true);
  }

  /** Closes the carousel; it will not come back by itself. */
  dismiss(): void {
    this.seen.set(true);
    this.opened.set(false);
  }
}
