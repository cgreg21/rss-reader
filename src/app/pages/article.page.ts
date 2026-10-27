import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from '../ui/icons';
import { ArticlesPage } from './articles.page';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, DatePipe, NgTemplateOutlet, ArticlesPage],
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

  /** Snapshot of the list order, so neighbours stay stable when reading an article hides it from the list. */
  private readonly order = signal<string[]>([]);
  private readonly neighbours = computed(() => {
    const order = this.order();
    const i = order.indexOf(this.id());
    const find = (j: number) => (i >= 0 && order[j] ? this.store.article(order[j]) : undefined);
    return { previous: find(i - 1), next: find(i + 1) };
  });

  protected readonly offset = signal(0);
  /** Article revealed by the current swipe, or null when the swipe leads back to the list. */
  protected readonly target = computed(() => {
    const o = this.offset();
    return o > 0 ? this.neighbours().next : o < 0 ? this.neighbours().previous : undefined;
  });

  private swipe: { x: number; y: number; id: number; horizontal: boolean | null } | null = null;
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = window.innerWidth;
  protected readonly abs = Math.abs;
  protected readonly animating = signal(false);
  protected readonly underTop = signal(0);
  protected readonly underHeight = signal(0);

  protected feedName(feedId: string): string {
    return this.store.feeds().find((f) => f.id === feedId)?.title ?? '';
  }

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
      swipe.horizontal = Math.abs(dx) > Math.abs(dy);
      if (swipe.horizontal) this.host.nativeElement.setPointerCapture(event.pointerId);
      else this.swipe = null;
    }
    if (swipe.horizontal) this.offset.set(dx);
  }

  /** Swiping right opens the next article, left the previous one; without one, back to the list. */
  protected swipeEnd(event: PointerEvent): void {
    const swipe = this.swipe;
    this.swipe = null;
    if (!swipe?.horizontal || event.pointerId !== swipe.id) return;
    this.host.nativeElement.releasePointerCapture?.(event.pointerId);
    this.animating.set(true);
    const offset = this.offset();
    if (event.type === 'pointerup' && Math.abs(offset) > 80) {
      const target = this.target();
      this.offset.set(offset > 0 ? this.width : -this.width);
      setTimeout(() => void this.router.navigate(target ? ['/article', target.id] : ['/']), 200);
    } else {
      this.offset.set(0);
      setTimeout(() => this.animating.set(false), 200);
    }
  }

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (!this.order().includes(id)) {
          const ids = this.store.visible().map((a) => a.id);
          this.order.set(ids.includes(id) ? ids : [id]);
        }
        this.offset.set(0);
        this.animating.set(false);
      });
    });
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
