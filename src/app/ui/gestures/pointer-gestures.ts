export const SWIPE_SLOP = 10;
export const SWIPE_THRESHOLD = 100;
const LONG_PRESS_MS = 500;
const LONG_PRESS_VIBRATION_MS = 30;

export type Axis = 'horizontal' | 'vertical';

export interface GestureMove {
  dx: number;
  dy: number;
  axis: Axis | null;
  /** True on the move that locks the gesture to the horizontal axis. */
  started: boolean;
}

export const isPrimaryPress = (event: PointerEvent): boolean => event.pointerType !== 'mouse' || event.button === 0;

/** Tracks one pointer and decides, once it moved past the slop, whether it is a horizontal or a vertical gesture. */
export class AxisGesture {
  private pointer: { x: number; y: number; id: number; axis: Axis | null } | null = null;

  get axis(): Axis | null {
    return this.pointer?.axis ?? null;
  }

  start(event: PointerEvent): void {
    this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null };
  }

  /** Delta of the tracked pointer; a vertical gesture is dropped, leaving the scroll to the browser. */
  move(event: PointerEvent): GestureMove | null {
    const p = this.pointer;
    if (!p || event.pointerId !== p.id) return null;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    let started = false;
    if (p.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_SLOP) {
      p.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      started = p.axis === 'horizontal';
      if (!started) this.pointer = null;
    }
    return { dx, dy, axis: p.axis, started };
  }

  /** Ends the gesture; null when the pointer is not the tracked one. */
  end(event: PointerEvent): Pick<GestureMove, 'dx' | 'dy' | 'axis'> | null {
    const p = this.pointer;
    this.pointer = null;
    if (!p || event.pointerId !== p.id) return null;
    return { dx: event.clientX - p.x, dy: event.clientY - p.y, axis: p.axis };
  }

  cancel(): void {
    this.pointer = null;
  }
}

/** Calls `onFire` when the pointer stays down, still within `slop`, for the long-press delay. */
export class LongPressTimer {
  fired = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private origin = { x: 0, y: 0 };

  constructor(private readonly onFire: () => void, private readonly slop = 8) {}

  start(event: PointerEvent): void {
    this.fired = false;
    this.origin = { x: event.clientX, y: event.clientY };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.fired = true;
      navigator.vibrate?.(LONG_PRESS_VIBRATION_MS);
      this.onFire();
    }, LONG_PRESS_MS);
  }

  move(event: PointerEvent): void {
    if (this.timer && Math.hypot(event.clientX - this.origin.x, event.clientY - this.origin.y) > this.slop) this.cancel();
  }

  cancel(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
