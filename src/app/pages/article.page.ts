import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink, Router } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from '../ui/icons';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article.page.html',
  host: { class: 'block min-h-full', '(pointerdown)': 'swipeStart($event)', '(pointerup)': 'swipeEnd($event)', '(pointercancel)': 'swipeStart(null)' },
})
export class ArticlePage {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  protected readonly ui = UI_ICONS;
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly feedTitle = computed(() => this.store.feeds().find((f) => f.id === this.article()?.feedId)?.title ?? '');

  private swipe: { x: number; y: number } | null = null;
  private readonly router = inject(Router);

  protected swipeStart(event: PointerEvent | null): void {
    this.swipe = event && event.pointerType !== 'mouse' ? { x: event.clientX, y: event.clientY } : null;
  }

  /** A rightward swipe goes back to the list. */
  protected swipeEnd(event: PointerEvent): void {
    const start = this.swipe;
    this.swipe = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (dx > 80 && Math.abs(dy) < dx * 0.6) void this.router.navigateByUrl('/');
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
