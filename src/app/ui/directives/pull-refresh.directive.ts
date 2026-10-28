import { Directive, ElementRef, inject, input, signal } from '@angular/core';

const THRESHOLD = 64;
const MAX_PULL = 110;
const RESISTANCE = 0.5;
const SLOP = 8;

/**
 * Elastic pull-to-refresh for a scrolling container: pulling down from the very top stretches an
 * indicator above the content, and releasing past the threshold runs the refresh function.
 */
@Directive({ selector: '[rssPullRefresh]', exportAs: 'pullRefresh' })
export class PullRefreshDirective {
  readonly refresh = input.required<() => Promise<void>>({ alias: 'rssPullRefresh' });
  readonly enabled = input(true, { alias: 'rssPullRefreshEnabled' });

  /** Height of the indicator, in px. */
  readonly distance = signal(0);
  readonly pulling = signal(false);
  readonly refreshing = signal(false);

  private start: { x: number; y: number } | null = null;
  private active = false;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      this.start = this.enabled() && !this.refreshing() && el.scrollTop <= 0 && e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
      this.active = false;
    }, { passive: true });
    // Non-passive: once the pull has started the browser must not scroll or bounce the page.
    el.addEventListener('touchmove', (e) => {
      const s = this.start;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (!this.active) {
        if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || el.scrollTop > 0) {
          this.start = null;
          return;
        }
        this.active = true;
        this.pulling.set(true);
      }
      e.preventDefault();
      this.distance.set(Math.min(MAX_PULL, Math.max(0, dy - SLOP) * RESISTANCE));
    }, { passive: false });
    const end = () => void this.release();
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  label(): string {
    if (this.refreshing()) return 'Actualisation…';
    return this.distance() >= THRESHOLD ? 'Relâcher pour actualiser' : 'Tirer pour actualiser';
  }

  private async release(): Promise<void> {
    const wasActive = this.active;
    this.start = null;
    this.active = false;
    this.pulling.set(false);
    if (!wasActive) return;
    if (this.distance() < THRESHOLD) {
      this.distance.set(0);
      return;
    }
    this.refreshing.set(true);
    this.distance.set(48);
    try {
      await this.refresh()();
    } finally {
      this.refreshing.set(false);
      this.distance.set(0);
    }
  }
}
