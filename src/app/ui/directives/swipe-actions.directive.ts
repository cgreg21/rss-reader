import { Directive, ElementRef, inject, output } from '@angular/core';

import { AxisGesture, SWIPE_THRESHOLD, isPrimaryPress } from '../gestures/pointer-gestures';

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
  private readonly gesture = new AxisGesture();
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
    if (!isPrimaryPress(e)) return;
    this.swiped = false;
    this.gesture.start(e);
  }

  protected move(e: PointerEvent): void {
    const m = this.gesture.move(e);
    if (m?.axis !== 'horizontal') return;
    if (m.started) {
      this.host.setPointerCapture(e.pointerId);
      this.host.style.transition = 'none';
    }
    this.host.style.transform = `translateX(${Math.sign(m.dx) * Math.pow(Math.abs(m.dx), 0.85)}px)`;
  }

  protected up(e: PointerEvent): void {
    const end = this.gesture.end(e);
    if (end?.axis !== 'horizontal') return;
    this.swiped = true;
    this.reset();
    if (end.dx <= -SWIPE_THRESHOLD) this.swipeLeft.emit();
    else if (end.dx >= SWIPE_THRESHOLD) this.swipeRight.emit();
  }

  protected reset(): void {
    this.gesture.cancel();
    this.host.style.transition = 'transform 500ms cubic-bezier(0.34, 1.8, 0.64, 1)';
    this.host.style.transform = '';
  }
}
