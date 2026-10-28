import { Injectable, signal } from '@angular/core';

/** Visibility of the "add a feed" modal (paste a URL or search for feeds). */
@Injectable({ providedIn: 'root' })
export class AddFeedDialogService {
  readonly opened = signal(false);

  open(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }
}
