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
    class: 'relative block min-h-full touch-none anim-fade-in',
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

  private swipe: { x: number; y: number; id: number; axis: 'x' | 'y' | null } | null = null;
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly width = window.innerWidth;
  protected readonly height = window.innerHeight;
  protected readonly offsetY = signal(0);
  protected readonly animating = signal(false);
  protected readonly underTop = signal(0);
  protected readonly underHeight = signal(0);

  protected readonly moving = computed(() => this.offset() !== 0 || this.offsetY() > 0);
  protected readonly currentTransform = computed(() =>
    this.offsetY() > 0 ? `translateY(${this.offsetY()}px)` : this.offset() ? `translateX(${this.offset()}px)` : null);
  protected readonly currentShadow = computed(() =>
    this.offsetY() > 0 ? '0 -12px 24px rgba(0,0,0,.45)' : this.offset() ? `${this.offset() > 0 ? '-12px' : '12px'} 0 24px rgba(0,0,0,.45)` : null);
  protected readonly underTransform = computed(() => {
    const y = this.offsetY();
    const progress = y > 0 ? y / this.height : Math.abs(this.offset()) / this.width;
    const shift = (1 - progress) * 80;
    const move = y > 0 ? `translateY(${-shift}px)` : `translateX(${this.offset() > 0 ? -shift : shift}px)`;
    return `${move} scale(${0.94 + 0.06 * progress})`;
  });
  protected readonly underOpacity = computed(() => 0.5 + 0.5 * (this.offsetY() > 0 ? this.offsetY() / this.height : Math.abs(this.offset()) / this.width));

  protected feedName(feedId: string): string {
    return this.store.feeds().find((f) => f.id === feedId)?.title ?? '';
  }

  protected swipeStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' || this.animating()) return;
    const main = this.host.nativeElement.closest('main');
    this.underTop.set(main ? main.getBoundingClientRect().top - this.host.nativeElement.getBoundingClientRect().top : 0);
    this.underHeight.set(main?.clientHeight ?? window.innerHeight);
    this.swipe = { x: event.clientX, y: event.clientY, id: event.pointerId, axis: null };
  }

  protected swipeMove(event: PointerEvent): void {
    const swipe = this.swipe;
    if (!swipe || event.pointerId !== swipe.id) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    if (swipe.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal || dy > 0) {
        swipe.axis = horizontal ? 'x' : 'y';
        this.host.nativeElement.setPointerCapture(event.pointerId);
      } else {
        this.swipe = null;
      }
    }
    if (swipe.axis === 'x') this.offset.set(dx);
    else if (swipe.axis === 'y') this.offsetY.set(Math.max(0, dy));
  }

  /** Right: next article, left: previous one, down: the list; without a neighbour, back to the list. */
  protected swipeEnd(event: PointerEvent): void {
    const swipe = this.swipe;
    this.swipe = null;
    if (!swipe?.axis || event.pointerId !== swipe.id) return;
    this.host.nativeElement.releasePointerCapture?.(event.pointerId);
    this.animating.set(true);
    const committed = event.type === 'pointerup';
    if (swipe.axis === 'y') {
      if (committed && this.offsetY() > 80) {
        this.offsetY.set(this.height);
        setTimeout(() => void this.router.navigate(['/']), 200);
        return;
      }
    } else if (committed && Math.abs(this.offset()) > 80) {
      const offset = this.offset();
      const target = this.target();
      this.offset.set(offset > 0 ? this.width : -this.width);
      setTimeout(() => void this.router.navigate(target ? ['/article', target.id] : ['/']), 200);
      return;
    }
    this.offset.set(0);
    this.offsetY.set(0);
    setTimeout(() => this.animating.set(false), 200);
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
        this.offsetY.set(0);
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
