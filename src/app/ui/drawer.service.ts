import { Injectable, signal } from '@angular/core';

/** State of the side drawer (the menu button of the header opens it). */
@Injectable({ providedIn: 'root' })
export class DrawerService {
  readonly opened = signal(false);

  show(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }
}
