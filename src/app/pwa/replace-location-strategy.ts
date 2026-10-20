import { Injectable } from '@angular/core';
import { PathLocationStrategy } from '@angular/common';

/**
 * Every navigation replaces the current history entry instead of adding one. The app is a set of
 * screens reached from its drawer, not a sequence of pages: with a single entry, the browser's
 * back/forward gestures (swipe from the screen edges, mouse buttons) have nothing to navigate to
 * and can no longer jump between screens or leave the app on an unexpected one.
 */
@Injectable()
export class ReplaceLocationStrategy extends PathLocationStrategy {
  override pushState(state: unknown, title: string, url: string, queryParams: string): void {
    this.replaceState(state, title, url, queryParams);
  }
}
