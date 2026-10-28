import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AxisGesture, LongPressTimer, isPrimaryPress } from './pointer-gestures';

const ptr = (x: number, y: number, id = 1, extra: Partial<PointerEvent> = {}) => ({ clientX: x, clientY: y, pointerId: id, pointerType: 'touch', button: 0, ...extra }) as PointerEvent;

describe('AxisGesture', () => {
  it('locks horizontally once past the slop', () => {
    const g = new AxisGesture();
    g.start(ptr(0, 0));
    expect(g.move(ptr(5, 2))).toMatchObject({ axis: null, started: false });
    expect(g.move(ptr(20, 3))).toMatchObject({ axis: 'horizontal', started: true, dx: 20 });
    expect(g.move(ptr(30, 3))).toMatchObject({ axis: 'horizontal', started: false });
    expect(g.axis).toBe('horizontal');
    expect(g.end(ptr(120, 3))).toEqual({ dx: 120, dy: 3, axis: 'horizontal' });
    expect(g.axis).toBeNull();
  });

  it('drops vertical gestures and other pointers', () => {
    const g = new AxisGesture();
    expect(g.move(ptr(20, 0))).toBeNull();
    g.start(ptr(0, 0));
    expect(g.move(ptr(20, 0, 2))).toBeNull();
    expect(g.move(ptr(2, 20))).toMatchObject({ axis: 'vertical', started: false });
    expect(g.move(ptr(2, 30))).toBeNull();
    g.start(ptr(0, 0));
    expect(g.end(ptr(0, 0, 2))).toBeNull();
    g.start(ptr(0, 0));
    g.cancel();
    expect(g.end(ptr(0, 0))).toBeNull();
  });
});

describe('LongPressTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the delay unless cancelled or moved', () => {
    const fire = vi.fn();
    const press = new LongPressTimer(fire, 6);
    press.start(ptr(0, 0));
    press.move(ptr(3, 0));
    vi.advanceTimersByTime(500);
    expect(fire).toHaveBeenCalledTimes(1);
    expect(press.fired).toBe(true);

    press.start(ptr(0, 0));
    expect(press.fired).toBe(false);
    press.move(ptr(10, 0));
    vi.advanceTimersByTime(600);
    expect(fire).toHaveBeenCalledTimes(1);

    press.start(ptr(0, 0));
    press.cancel();
    vi.advanceTimersByTime(600);
    expect(fire).toHaveBeenCalledTimes(1);
  });
});

describe('isPrimaryPress', () => {
  it('rejects secondary mouse buttons only', () => {
    expect(isPrimaryPress(ptr(0, 0, 1, { pointerType: 'mouse', button: 2 }))).toBe(false);
    expect(isPrimaryPress(ptr(0, 0, 1, { pointerType: 'mouse', button: 0 }))).toBe(true);
    expect(isPrimaryPress(ptr(0, 0, 1, { button: 2 }))).toBe(true);
  });
});
