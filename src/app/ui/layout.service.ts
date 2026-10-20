import { Injectable, signal } from '@angular/core';

/** Matches the `wide` variant of styles.css (a phone in landscape is too short and keeps the mobile layout): from here the drawer becomes a permanent sidebar. */
export const WIDE_QUERY = '(min-width: 768px) and (min-height: 500px)';

/** Matches the `sidebar` variant of styles.css: wide and in landscape (a tablet in portrait keeps the drawer hidden). */
export const SIDEBAR_QUERY = `${WIDE_QUERY} and (orientation: landscape)`;

/** Exposes whether the tablet / desktop layout is active, for the parts CSS alone cannot switch. */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly wide = signal(false);
  /** The drawer is a permanent sidebar. */
  readonly sidebar = signal(false);

  constructor() {
    this.follow(WIDE_QUERY, this.wide);
    this.follow(SIDEBAR_QUERY, this.sidebar);
  }

  private follow(query: string, target: { set(value: boolean): void }): void {
    const media = window.matchMedia(query);
    target.set(media.matches);
    media.addEventListener('change', (event) => target.set(event.matches));
  }
}
