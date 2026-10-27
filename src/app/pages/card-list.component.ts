import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, input } from '@angular/core';

import { Article } from '../rss/models';
import { ArticleCardComponent } from './article-card.component';
import { RevealDirective } from '../ui/reveal.directive';

/** Swipeable cards laid out one under the other; neighbours tuck about a third under the centered card. */
@Component({
  selector: 'rss-card-list',
  imports: [ArticleCardComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col overflow-x-clip py-10">
      @for (a of articles(); track a.id) {
        <div rssReveal data-card class="relative z-0 [&:not(:first-child)]:-mt-36 data-[active]:z-10"><rss-article-card [article]="a" /></div>
      }
    </div>`,
})
export class CardListComponent implements AfterViewInit, OnDestroy {
  readonly articles = input.required<Article[]>();
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;
  private readonly ratios = new Map<Element, number>();
  private active: Element | null = null;

  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.ratios.set(e.target, e.intersectionRatio);
          else this.ratios.delete(e.target);
        }
        let best: Element | null = null;
        let max = -1;
        for (const [el, ratio] of this.ratios) if (ratio > max) { max = ratio; best = el; }
        if (best === this.active) return;
        this.active?.removeAttribute('data-active');
        best?.setAttribute('data-active', '');
        this.active = best;
      },
      { root: this.host.closest('main'), rootMargin: '-40% 0px -40% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    const observe = (): void => {
      this.ratios.clear();
      this.host.querySelectorAll('[data-card]').forEach((el) => this.observer?.observe(el));
    };
    observe();
    new MutationObserver(observe).observe(this.host.firstElementChild!, { childList: true });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
