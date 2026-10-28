import { Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

import { LongPressTimer, isPrimaryPress } from '../gestures/pointer-gestures';

/** Emits after the pointer stays down on the element; the click that follows the release is swallowed. */
@Directive({
  selector: '[rssLongPress]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(contextmenu)': '$event.preventDefault()',
    style: '-webkit-touch-callout: none; -webkit-user-select: none; user-select: none',
  },
})
export class LongPressDirective implements OnDestroy {
  readonly rssLongPress = output<void>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly press = new LongPressTimer(() => this.rssLongPress.emit());

  constructor() {
    this.host.addEventListener(
      'click',
      (e) => {
        if (!this.press.fired) return;
        this.press.fired = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  }

  protected start(event: PointerEvent): void {
    if (!isPrimaryPress(event)) return;
    this.press.start(event);
  }

  protected move(event: PointerEvent): void {
    this.press.move(event);
  }

  protected cancel(): void {
    this.press.cancel();
  }

  ngOnDestroy(): void {
    this.cancel();
  }
}
