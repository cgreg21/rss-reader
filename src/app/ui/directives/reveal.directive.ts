import { Directive, ElementRef, OnDestroy, OnInit, inject } from '@angular/core';

/** Fades and slides the element in when it scrolls into view, and out when it leaves. */
@Directive({ selector: '[rssReveal]', host: { class: 'reveal' } })
export class RevealDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;

  ngOnInit(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.el.classList.add('reveal-in');
      return;
    }
    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      const above = entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
      this.el.style.setProperty('--reveal-y', above ? '-24px' : '24px');
      this.el.classList.toggle('reveal-in', entry.isIntersecting);
    }, { threshold: [0, 0.15] });
    this.observer.observe(this.el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
