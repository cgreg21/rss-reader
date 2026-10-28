import { Signal, computed, signal } from '@angular/core';

export type SwipeDirection = 'next' | 'previous' | 'down';

export interface SwipeNavigationOptions {
  /** Element receiving the touch events; its closest `main` is the scroll container. */
  host: HTMLElement;
  /** 1 in LTR, -1 in RTL, so "next" is always the reading direction. */
  sign: Signal<1 | -1>;
  /** Called once the exit animation is over. */
  onCommit: (direction: SwipeDirection) => void;
}

const DECIDE_PX = 10;
const COMMIT_PX = 80;
const ANIMATION_MS = 200;

/** Touch-driven navigation of the article page: horizontal swipes to the neighbours, pull down back to the list.
 *  Exposes the signals the template needs for the two stacked panes (current page and the one revealed under it). */
export class SwipeNavigation {
  readonly width = window.innerWidth;
  readonly height = window.innerHeight;
  /** Horizontal offset in the reading direction (> 0 reveals the next article). */
  readonly offset = signal(0);
  readonly offsetY = signal(0);
  readonly animating = signal(false);
  readonly underTop = signal(0);
  readonly underHeight = signal(0);

  readonly moving = computed(() => this.offset() !== 0 || this.offsetY() > 0);
  readonly currentTransform = computed(() =>
    this.offsetY() > 0 ? `translateY(${this.offsetY()}px)` : this.offset() ? `translateX(${this.offset() * this.sign()}px)` : null);
  readonly currentShadow = computed(() =>
    this.offsetY() > 0 ? '0 -12px 24px rgba(0,0,0,.45)' : this.offset() ? `${(this.offset() > 0 ? -12 : 12) * this.sign()}px 0 24px rgba(0,0,0,.45)` : null);
  readonly underTransform = computed(() => {
    const progress = this.progress();
    const shift = (1 - progress) * 80;
    const move = this.offsetY() > 0 ? `translateY(${-shift}px)` : `translateX(${(this.offset() > 0 ? -shift : shift) * this.sign()}px)`;
    return `${move} scale(${0.94 + 0.06 * progress})`;
  });
  readonly underOpacity = computed(() => 0.5 + 0.5 * this.progress());

  private readonly progress = computed(() => (this.offsetY() > 0 ? this.offsetY() / this.height : Math.abs(this.offset()) / this.width));
  private readonly host: HTMLElement;
  private readonly sign: Signal<1 | -1>;
  private readonly onCommit: (direction: SwipeDirection) => void;
  private touch: { x: number; y: number; axis: 'x' | 'y' | null; atTop: boolean } | null = null;

  constructor({ host, sign, onCommit }: SwipeNavigationOptions) {
    this.host = host;
    this.sign = sign;
    this.onCommit = onCommit;
    // Touch events (not pointer ones) so vertical scrolling stays native: the page only takes over horizontal
    // moves, and a pull down when the article is already scrolled to the top.
    host.addEventListener('touchstart', (e) => this.start(e), { passive: true });
    // Non-passive: preventDefault stops the native scroll once the swipe is ours.
    host.addEventListener('touchmove', (e) => this.move(e), { passive: false });
    host.addEventListener('touchend', () => this.end(true));
    host.addEventListener('touchcancel', () => this.end(false));
  }

  /** Back to the resting position, for instance when the displayed article changes. */
  reset(): void {
    this.offset.set(0);
    this.offsetY.set(0);
    this.animating.set(false);
  }

  private start(event: TouchEvent): void {
    if (this.animating() || event.touches.length !== 1 || (event.target as Element).closest('audio, video, iframe, rss-audio-player')) return;
    const main = this.host.closest('main');
    this.underTop.set(main ? main.getBoundingClientRect().top - this.host.getBoundingClientRect().top : 0);
    this.underHeight.set(main?.clientHeight ?? window.innerHeight);
    const t = event.touches[0];
    this.touch = { x: t.clientX, y: t.clientY, axis: null, atTop: (main?.scrollTop ?? 0) <= 0 };
  }

  private move(event: TouchEvent): void {
    const touch = this.touch;
    if (!touch) return;
    const t = event.touches[0];
    const dx = t.clientX - touch.x;
    const dy = t.clientY - touch.y;
    if (touch.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= DECIDE_PX) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal || (dy > 0 && touch.atTop)) touch.axis = horizontal ? 'x' : 'y';
      else return void (this.touch = null);
    }
    if (!touch.axis) return;
    if (event.cancelable) event.preventDefault();
    if (touch.axis === 'x') this.offset.set(dx * this.sign());
    else this.offsetY.set(Math.max(0, dy));
  }

  /** Right: next article, left: previous one, down: the list. */
  private end(committed: boolean): void {
    const touch = this.touch;
    this.touch = null;
    if (!touch?.axis) return;
    this.animating.set(true);
    if (touch.axis === 'y' && committed && this.offsetY() > COMMIT_PX) {
      this.offsetY.set(this.height);
      return void setTimeout(() => this.onCommit('down'), ANIMATION_MS);
    }
    if (touch.axis === 'x' && committed && Math.abs(this.offset()) > COMMIT_PX) {
      const next = this.offset() > 0;
      this.offset.set(next ? this.width : -this.width);
      return void setTimeout(() => this.onCommit(next ? 'next' : 'previous'), ANIMATION_MS);
    }
    this.offset.set(0);
    this.offsetY.set(0);
    setTimeout(() => this.animating.set(false), ANIMATION_MS);
  }
}
