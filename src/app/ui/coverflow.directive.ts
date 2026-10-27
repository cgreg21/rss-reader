import { Directive, ElementRef, OnDestroy, afterNextRender, inject, input } from '@angular/core';

const DEFAULT_TILT = 38;

interface Slot {
  card: HTMLElement;
  wrapper: HTMLElement;
  /** Center of the wrapper from the top of the scrolling content, and its height. */
  center: number;
  height: number;
}

/**
 * Vertical coverflow: the `[data-coverflow]` descendants tilt, shrink and fade the further they sit
 * from the middle of the scrolling container, and lie flat when centered. With a tilt of 0 only the
 * scale and opacity change, through properties that don't clash with the element's own transform.
 * Positions are measured once (and on resize / content changes), so scrolling only does arithmetic.
 */
@Directive({ selector: '[rssCoverflow]', host: { style: 'perspective: 900px; position: relative' } })
export class CoverflowDirective implements OnDestroy {
  readonly tilt = input(DEFAULT_TILT, { alias: 'rssCoverflow', transform: (v: number | '') => (v === '' ? DEFAULT_TILT : v) });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private scroller: HTMLElement | null = null;
  private slots: Slot[] = [];
  private gap = 0;
  private measureFrame = 0;
  private mutations: MutationObserver | null = null;
  private resizes: ResizeObserver | null = null;
  private readonly onScroll = (): void => this.update();
  private readonly scheduleMeasure = (): void => {
    if (this.measureFrame) return;
    this.measureFrame = requestAnimationFrame(() => {
      this.measureFrame = 0;
      this.measure();
      this.update();
    });
  };

  constructor() {
    afterNextRender(() => {
      this.scroller = this.host.closest('main');
      if (this.tilt() > 0 && this.scroller) this.scroller.style.scrollSnapType = 'y mandatory';
      (this.scroller ?? window).addEventListener('scroll', this.onScroll, { passive: true });
      this.mutations = new MutationObserver(this.scheduleMeasure);
      this.mutations.observe(this.host, { childList: true });
      this.resizes = new ResizeObserver(this.scheduleMeasure);
      this.resizes.observe(this.host);
      if (this.scroller) this.resizes.observe(this.scroller);
      this.measure();
      this.update();
    });
  }

  private measure(): void {
    const scroller = this.scroller;
    const hostTop = this.host.getBoundingClientRect().top - (scroller?.getBoundingClientRect().top ?? 0) + (scroller?.scrollTop ?? window.scrollY);
    this.gap = parseFloat(getComputedStyle(this.host).rowGap) || 0;
    this.slots = Array.from(this.host.querySelectorAll<HTMLElement>('[data-coverflow]')).flatMap((card) => {
      const wrapper = this.tilt() > 0 ? card.parentElement : card;
      if (!wrapper) return [];
      if (this.tilt() > 0) {
        wrapper.style.scrollSnapAlign = 'center';
        card.style.position = 'relative';
      }
      card.style.willChange = this.tilt() > 0 ? 'transform, opacity' : 'scale, filter';
      return [{ card, wrapper, center: hostTop + wrapper.offsetTop + wrapper.offsetHeight / 2, height: wrapper.offsetHeight }];
    });
  }

  private update(): void {
    const viewHeight = this.scroller?.clientHeight ?? window.innerHeight;
    const scrollTop = this.scroller?.scrollTop ?? window.scrollY;
    const middle = viewHeight / 2;
    const tilt = this.tilt();
    for (const slot of this.slots) {
      const d = Math.max(-1, Math.min(1, (slot.center - scrollTop - middle) / (middle || 1)));
      const a = Math.abs(d);
      const scale = (1 - 0.1 * a).toFixed(3);
      const opacity = (1 - 0.45 * a * a).toFixed(3);
      if (tilt === 0) {
        slot.card.style.scale = scale;
        slot.card.style.filter = `opacity(${opacity})`;
        continue;
      }
      // Neighbours slide under the centered card, so a third of their height stays hidden.
      const ramp = Math.min(1, a / 0.4);
      const shift = -Math.sign(d) * (slot.height / 3 + this.gap) * ramp * ramp * (3 - 2 * ramp);
      slot.card.style.zIndex = String(Math.round((1 - a) * 100));
      slot.card.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0) rotateX(${(d * tilt).toFixed(2)}deg) scale(${scale})`;
      slot.card.style.opacity = opacity;
    }
  }

  ngOnDestroy(): void {
    if (this.scroller) this.scroller.style.scrollSnapType = '';
    (this.scroller ?? window).removeEventListener('scroll', this.onScroll);
    this.mutations?.disconnect();
    this.resizes?.disconnect();
    cancelAnimationFrame(this.measureFrame);
  }
}
