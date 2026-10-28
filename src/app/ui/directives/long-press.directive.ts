import { Directive, ElementRef, OnDestroy, inject, output } from '@angular/core';

const DELAY_MS = 500;
const MOVE_SLOP = 8;

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
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin = { x: 0, y: 0 };
  private fired = false;

  constructor() {
    this.host.addEventListener(
      'click',
      (e) => {
        if (!this.fired) return;
        this.fired = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true,
    );
  }

  protected start(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.fired = false;
    this.origin = { x: event.clientX, y: event.clientY };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.fired = true;
      navigator.vibrate?.(30);
      this.rssLongPress.emit();
    }, DELAY_MS);
  }

  protected move(event: PointerEvent): void {
    if (this.timer && Math.hypot(event.clientX - this.origin.x, event.clientY - this.origin.y) > MOVE_SLOP) this.cancel();
  }

  protected cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  ngOnDestroy(): void {
    this.cancel();
  }
}
