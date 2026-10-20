import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from '../ui/icons';
import { ArticlesPage } from './articles.page';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, DatePipe, ArticlesPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article.page.html',
  host: {
    class: 'relative block min-h-full anim-fade-in',
    '(pointerdown)': 'swipeStart($event)',
    '(pointermove)': 'swipeMove($event)',
    '(pointerup)': 'swipeEnd($event)',
    '(pointercancel)': 'swipeEnd($event)',
  },
})
export class ArticlePage {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  protected readonly ui = UI_ICONS;
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly feedTitle = computed(() => this.store.feeds().find((f) => f.id === this.article()?.feedId)?.title ?? '');

  private swipe: { x: number; y: number; id: number; horizontal: boolean | null } | null = null;
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = window.innerWidth;
  protected readonly offset = signal(0);
  protected readonly animating = signal(false);
  protected readonly underTop = signal(0);
  protected readonly underHeight = signal(0);

  protected swipeStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || this.animating()) return;
    const main = this.host.nativeElement.closest('main');
    this.underTop.set(main ? main.getBoundingClientRect().top - this.host.nativeElement.getBoundingClientRect().top : 0);
    this.underHeight.set(main?.clientHeight ?? window.innerHeight);
    this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId, horizontal: null };
  }

  protected swipeMove(event: PointerEvent): void {
    const swipe = this.swipe;
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (swipe.horizontal === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
      swipe.horizontal = dx > 0 && Math.abs(dx) > Math.abs(dy);
      if (swipe.horizontal) this.host.nativeElement.setPointerCapture(event.pointerId);
      else this.swipe = null;
    }
    if (swipe.horizontal) this.offset.set(Math.max(0, dx));
  }

  /** A rightward swipe slides the article out and goes back to the list. */
  protected swipeEnd(event: PointerEvent): void {
    const swipe = this.swipe;
    this.swipe = null;
    if (!swipe?.horizontal || event.pointerId !== swipe.id) return;
    this.host.nativeElement.releasePointerCapture?.(event.pointerId);
    this.animating.set(true);
    if (event.type === 'pointerup' && this.offset() > 80) {
      this.offset.set(this.width);
      setTimeout(() => void this.router.navigateByUrl('/'), 200);
    } else {
      this.offset.set(0);
      setTimeout(() => this.animating.set(false), 200);
    }
  }

  constructor() {
    let autoReadId: string | null = null;
    effect(() => {
      const a = this.article();
      if (a && a.id !== autoReadId) {
        autoReadId = a.id;
        if (!a.read) void this.store.patch(a.id, { read: true });
      }
    });
  }
}
