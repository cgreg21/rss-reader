import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LongPressDirective } from './long-press.directive';
import { PullRefreshDirective } from './pull-refresh.directive';
import { RevealDirective } from './reveal.directive';
import { SwipeActionsDirective } from './swipe-actions.directive';

export const pointer = (type: string, init: { x?: number; y?: number; id?: number; pointerType?: string; button?: number } = {}): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: init.x ?? 0, clientY: init.y ?? 0, pointerId: init.id ?? 1, pointerType: init.pointerType ?? 'touch', button: init.button ?? 0 });
  return e;
};

const touch = (type: string, x: number, y: number, count = 1): Event => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, { touches: Array.from({ length: count }, () => ({ clientX: x, clientY: y })) });
  return e;
};

@Component({
  imports: [LongPressDirective, SwipeActionsDirective, RevealDirective, PullRefreshDirective],
  template: `
    <div id="lp" (rssLongPress)="log('long')"></div>
    <div id="sw" rssSwipe (swipeLeft)="log('left')" (swipeRight)="log('right')"></div>
    <div id="rv" rssReveal></div>
    <div id="pr" [rssPullRefresh]="refresh" [rssPullRefreshEnabled]="enabled" #p="pullRefresh">{{ p.label() }}</div>
  `,
})
class HostComponent {
  logs: string[] = [];
  enabled = true;
  refresh = vi.fn(async () => undefined);
  log(s: string): void {
    this.logs.push(s);
  }
}

describe('directives', () => {
  let host: HostComponent;
  let root: HTMLElement;
  const el = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;

  beforeEach(() => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.componentInstance;
    root = fixture.nativeElement;
    el('sw').setPointerCapture = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('LongPress', () => {
    it('fires after the delay and swallows the following click', () => {
      navigator.vibrate = vi.fn();
      el('lp').dispatchEvent(pointer('pointerdown'));
      vi.advanceTimersByTime(500);
      expect(host.logs).toEqual(['long']);
      const click = new Event('click', { bubbles: true, cancelable: true });
      el('lp').dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      const second = new Event('click', { cancelable: true });
      el('lp').dispatchEvent(second);
      expect(second.defaultPrevented).toBe(false);
    });

    it('cancels on release, large moves, and ignores secondary mouse buttons', () => {
      const lp = el('lp');
      lp.dispatchEvent(pointer('pointerdown'));
      lp.dispatchEvent(pointer('pointermove', { x: 2 }));
      lp.dispatchEvent(pointer('pointerup'));
      vi.advanceTimersByTime(600);
      lp.dispatchEvent(pointer('pointerdown'));
      lp.dispatchEvent(pointer('pointermove', { x: 50 }));
      lp.dispatchEvent(pointer('pointermove', { x: 60 }));
      vi.advanceTimersByTime(600);
      lp.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', button: 2 }));
      vi.advanceTimersByTime(600);
      expect(host.logs).toEqual([]);
      const menu = new Event('contextmenu', { cancelable: true });
      lp.dispatchEvent(menu);
      expect(menu.defaultPrevented).toBe(true);
    });

    it('cancels its timer on destroy', () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      fixture.nativeElement.querySelector('#lp').dispatchEvent(pointer('pointerdown'));
      fixture.destroy();
      vi.advanceTimersByTime(600);
      expect(fixture.componentInstance.logs).toEqual([]);
    });
  });

  describe('SwipeActions', () => {
    const swipe = (dx: number, dy = 0, id = 1) => {
      const sw = el('sw');
      sw.dispatchEvent(pointer('pointerdown'));
      sw.dispatchEvent(pointer('pointermove', { x: dx / 2, y: dy / 2, id }));
      sw.dispatchEvent(pointer('pointermove', { x: dx, y: dy, id }));
      sw.dispatchEvent(pointer('pointerup', { x: dx, y: dy, id }));
    };

    it('emits left and right past the threshold and swallows the click', () => {
      swipe(-150);
      swipe(150);
      expect(host.logs).toEqual(['left', 'right']);
      const click = new Event('click', { cancelable: true });
      el('sw').dispatchEvent(click);
      expect(click.defaultPrevented).toBe(true);
      const again = new Event('click', { cancelable: true });
      el('sw').dispatchEvent(again);
      expect(again.defaultPrevented).toBe(false);
    });

    it('snaps back for short swipes', () => {
      swipe(60);
      expect(host.logs).toEqual([]);
      expect(el('sw').style.transform).toBe('');
    });

    it('ignores vertical gestures, tiny moves, other pointers and secondary buttons', () => {
      swipe(0, 80);
      swipe(5);
      swipe(150, 0, 2);
      const sw = el('sw');
      sw.dispatchEvent(pointer('pointermove', { x: 99 }));
      sw.dispatchEvent(pointer('pointerup', { x: 99 }));
      sw.dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', button: 2 }));
      sw.dispatchEvent(pointer('pointermove', { x: 150 }));
      sw.dispatchEvent(pointer('pointerdown'));
      sw.dispatchEvent(pointer('pointerup', { x: 5 }));
      sw.dispatchEvent(pointer('pointerdown'));
      sw.dispatchEvent(pointer('pointercancel'));
      expect(host.logs).toEqual([]);
    });
  });

  describe('Reveal', () => {
    it('falls back to visible without IntersectionObserver', () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#rv').classList.contains('reveal-in')).toBe(true);
      fixture.destroy();
    });

    it('toggles with intersection', () => {
      let callback: (entries: unknown[]) => void = () => undefined;
      const disconnect = vi.fn();
      vi.stubGlobal('IntersectionObserver', class {
        constructor(cb: typeof callback) {
          callback = cb;
        }
        observe(): void {}
        disconnect = disconnect;
      });
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const rv = fixture.nativeElement.querySelector('#rv') as HTMLElement;
      callback([{ isIntersecting: true, boundingClientRect: { top: -10 }, rootBounds: { top: 0 } }]);
      expect(rv.classList.contains('reveal-in')).toBe(true);
      expect(rv.style.getPropertyValue('--reveal-y')).toBe('-24px');
      callback([{ isIntersecting: false, boundingClientRect: { top: 10 }, rootBounds: null }]);
      expect(rv.classList.contains('reveal-in')).toBe(false);
      expect(rv.style.getPropertyValue('--reveal-y')).toBe('24px');
      fixture.destroy();
      expect(disconnect).toHaveBeenCalled();
    });
  });

  describe('PullRefresh', () => {
    const pull = (dy: number, dx = 0) => {
      const pr = el('pr');
      pr.dispatchEvent(touch('touchstart', 0, 0));
      const move = touch('touchmove', dx, dy);
      pr.dispatchEvent(move);
      return move;
    };

    it('refreshes after a long enough pull', async () => {
      pull(5);
      const move = pull(200);
      expect(move.defaultPrevented).toBe(true);
      const pr = el('pr');
      pr.dispatchEvent(touch('touchend', 0, 0));
      host.refresh.mockImplementation(async () => undefined);
      await vi.advanceTimersByTimeAsync(0);
      expect(host.refresh).toHaveBeenCalled();
    });

    it('shows labels while pulling and refreshing', async () => {
      const fixture = TestBed.createComponent(HostComponent);
      fixture.detectChanges();
      const pr = fixture.nativeElement.querySelector('#pr') as HTMLElement;
      let resolve!: () => void;
      fixture.componentInstance.refresh.mockImplementation(() => new Promise<undefined>((r) => (resolve = () => r(undefined))));
      pr.dispatchEvent(touch('touchstart', 0, 0));
      pr.dispatchEvent(touch('touchmove', 0, 40));
      fixture.detectChanges();
      expect(pr.textContent).toContain('Tirer');
      pr.dispatchEvent(touch('touchmove', 0, 300));
      fixture.detectChanges();
      expect(pr.textContent).toContain('cher pour');
      pr.dispatchEvent(touch('touchend', 0, 0));
      fixture.detectChanges();
      expect(pr.textContent).toContain('Actualisation');
      pr.dispatchEvent(touch('touchstart', 0, 0));
      resolve();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(pr.textContent).toContain('Tirer');
    });

    it('resets on short pulls, and ignores sideways, upward, multi-touch and scrolled gestures', () => {
      const pr = el('pr');
      pull(30);
      pr.dispatchEvent(touch('touchend', 0, 0));
      pull(-30);
      pull(20, 60);
      pr.dispatchEvent(touch('touchmove', 0, 100));
      pr.dispatchEvent(touch('touchstart', 0, 0, 2));
      pr.dispatchEvent(touch('touchmove', 0, 100));
      pr.scrollTop = 50;
      pr.dispatchEvent(touch('touchstart', 0, 0));
      pr.dispatchEvent(touch('touchmove', 0, 100));
      pr.dispatchEvent(touch('touchcancel', 0, 0));
      host.enabled = false;
      expect(host.refresh).not.toHaveBeenCalled();
    });

    it('stops when scrolled mid gesture and when disabled', () => {
      const pr = el('pr');
      pr.dispatchEvent(touch('touchstart', 0, 0));
      pr.scrollTop = 20;
      pr.dispatchEvent(touch('touchmove', 0, 100));
      pr.dispatchEvent(touch('touchend', 0, 0));
      expect(host.refresh).not.toHaveBeenCalled();
    });
  });
});
