import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from './snackbar.service';

describe('SnackbarService', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows a success message that expires', () => {
    const s = new SnackbarService();
    const id = s.show('hi');
    expect(s.current()).toMatchObject({ id, text: 'hi', kind: 'success' });
    vi.advanceTimersByTime(3500);
    expect(s.current()).toBeNull();
  });

  it('keeps errors and actionable messages longer, and 0 forever', () => {
    const s = new SnackbarService();
    s.error('bad');
    expect(s.current()?.kind).toBe('error');
    vi.advanceTimersByTime(3600);
    expect(s.current()).not.toBeNull();
    vi.advanceTimersByTime(2500);
    expect(s.current()).toBeNull();

    s.show('a', { actions: [{ label: 'x', run: vi.fn() }] });
    vi.advanceTimersByTime(5900);
    expect(s.current()).not.toBeNull();
    s.show('forever', { duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(s.current()).not.toBeNull();
  });

  it('replaces messages and dismisses by id', () => {
    const s = new SnackbarService();
    const a = s.show('a');
    const b = s.show('b');
    s.dismiss(a);
    expect(s.current()?.text).toBe('b');
    s.dismiss(b);
    expect(s.current()).toBeNull();
    s.show('c');
    s.dismiss();
    expect(s.current()).toBeNull();
  });

  it('runs an action and dismisses', () => {
    const s = new SnackbarService();
    const run = vi.fn();
    s.show('a', { duration: 0 });
    s.runAction({ label: 'x', run });
    expect(run).toHaveBeenCalled();
    expect(s.current()).toBeNull();
  });
});
