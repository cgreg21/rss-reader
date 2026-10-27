import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LiveChannel } from './live-channel';

class FakeSocket {
  static all: FakeSocket[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  close(): void {
    this.closed = true;
    this.onclose?.();
  }
}

describe('LiveChannel', () => {
  beforeEach(() => {
    FakeSocket.all = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('calls back on "changed" only', () => {
    const spy = vi.fn();
    new LiveChannel(spy).open('ws://x');
    FakeSocket.all[0].onmessage?.({ data: 'pong' });
    FakeSocket.all[0].onmessage?.({ data: 'changed' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps one socket for the same url and swaps on a new one', () => {
    const channel = new LiveChannel(() => undefined);
    channel.open('ws://a');
    channel.open('ws://a');
    expect(FakeSocket.all).toHaveLength(1);
    channel.open('ws://b');
    expect(FakeSocket.all[0].closed).toBe(true);
    expect(FakeSocket.all[1].url).toBe('ws://b');
  });

  it('reconnects after a drop but not after close()', () => {
    const channel = new LiveChannel(() => undefined);
    channel.open('ws://a');
    FakeSocket.all[0].onclose?.();
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.all).toHaveLength(2);
    channel.close();
    vi.advanceTimersByTime(10000);
    expect(FakeSocket.all).toHaveLength(2);
  });
});
