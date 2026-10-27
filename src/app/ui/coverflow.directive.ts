import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input } from '@angular/core';

const DEFAULT_TILT = 38;

/**
 * Vertical coverflow: the `[data-coverflow]` descendants tilt, shrink and fade the further they sit
 * from the middle of the scrolling container, and lie flat when centered. With a tilt of 0 only the
 * scale and opacity change, through properties that don't clash with the element's own transform.
 */
@Directive({ selector: '[rssCoverflow]', host: { style: 'perspective: 900px' } })
export class CoverflowDirective implements OnDestroy {
  readonly tilt = input(DEFAULT_TILT, { alias: 'rssCoverflow', transform: (v: number | '') => (v === '' ? DEFAULT_TILT : v) });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private scroller: HTMLElement | null = null;
  private frame = 0;
  private mutations: MutationObserver | null = null;
  private readonly schedule = (): void => {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  };

  constructor() {
    afterNextRender(() => {
      this.scroller = this.host.closest('main');
      if (this.tilt() > 0 && this.scroller) this.scroller.style.scrollSnapType = 'y mandatory';
      (this.scroller ?? window).addEventListener('scroll', this.schedule, { passive: true });
      window.addEventListener('resize', this.schedule);
      this.mutations = new MutationObserver(this.schedule);
      this.mutations.observe(this.host, { childList: true, subtree: true });
      this.update();
    });
  }

  private update(): void {
    const bounds = this.scroller?.getBoundingClientRect() ?? { top: 0, height: window.innerHeight };
    const middle = bounds.top + bounds.height / 2;
    const half = bounds.height / 2 || 1;
    for (const el of Array.from(this.host.querySelectorAll<HTMLElement>('[data-coverflow]'))) {
      // Measured on the wrapper, which isn't moved by this effect, so the result doesn't feed back.
      const rect = (el.parentElement ?? el).getBoundingClientRect();
      const d = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - middle) / half));
      const a = Math.abs(d);
      if (this.tilt() === 0) {
        el.style.scale = (1 - 0.1 * a).toFixed(3);
        el.style.filter = `opacity(${(1 - 0.45 * a * a).toFixed(3)})`;
      } else {
        // Neighbours slide under the centered card, so a third of their height stays hidden.
        const gap = parseFloat(getComputedStyle(this.host).rowGap) || 0;
        const ramp = Math.min(1, a / 0.4);
        const shift = -Math.sign(d) * (rect.height / 3 + gap) * ramp * ramp * (3 - 2 * ramp);
        el.style.position = 'relative';
        if (el.parentElement) el.parentElement.style.scrollSnapAlign = 'center';
        el.style.zIndex = String(Math.round((1 - a) * 100));
        el.style.transform = `translateY(${shift.toFixed(1)}px) rotateX(${(d * this.tilt()).toFixed(2)}deg) scale(${(1 - 0.1 * a).toFixed(3)})`;
        el.style.opacity = (1 - 0.45 * a * a).toFixed(3);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.scroller) this.scroller.style.scrollSnapType = '';
    (this.scroller ?? window).removeEventListener('scroll', this.schedule);
    window.removeEventListener('resize', this.schedule);
    this.mutations?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
