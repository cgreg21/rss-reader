import { Directive, ElementRef, inject, output } from '@angular/core';

const SLOP = 10;
const THRESHOLD = 100;

/** Horizontal swipe on a list item: left emits `swipeLeft`, right emits `swipeRight`, then the item snaps back. */
@Directive({
  selector: '[rssSwipe]',
  host: {
    '(pointerdown)': 'down($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'up($event)',
    '(pointercancel)': 'reset()',
    class: 'touch-pan-y',
  },
})
export class SwipeActionsDirective {
  readonly swipeLeft = output<void>();
  readonly swipeRight = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private start: { x: number; y: number; id: number } | null = null;
  private horizontal = false;
  private swiped = false;

  constructor() {
    this.host.addEventListener(
      'click',
      (e) => {
        if (!this.swiped) return;
        this.swiped = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  }

  protected down(e: PointerEvent): void {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.swiped = false;
    this.horizontal = false;
    this.start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }

  protected move(e: PointerEvent): void {
    const s = this.start;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!this.horizontal) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        this.start = null;
        return;
      }
      this.horizontal = true;
      this.host.setPointerCapture(e.pointerId);
      this.host.style.transition = 'none';
    }
    this.host.style.transform = `translateX(${dx}px)`;
  }

  protected up(e: PointerEvent): void {
    const s = this.start;
    if (!s || e.pointerId !== s.id || !this.horizontal) {
      this.start = null;
      return;
    }
    const dx = e.clientX - s.x;
    this.swiped = true;
    this.reset();
    if (dx <= -THRESHOLD) this.swipeLeft.emit();
    else if (dx >= THRESHOLD) this.swipeRight.emit();
  }

  protected reset(): void {
    this.start = null;
    this.horizontal = false;
    this.host.style.transition = 'transform 200ms';
    this.host.style.transform = '';
  }
}
