import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { ArticlesStore } from '../../rss/articles.store';
import { FeedsStore } from '../../rss/feeds.store';
import { Article } from '../../rss/models';
import { UI_ICONS } from '../../ui/icons';
import { AxisGesture, LongPressTimer, SWIPE_THRESHOLD, isPrimaryPress } from '../../ui/gestures/pointer-gestures';
import { ProxyImgDirective } from '../../ui/directives/proxy-img.directive';

const TAP_SLOP = 6;
const FLY_MS = 200;

type Direction = 'left' | 'right';

/** Card with a Tinder-style swipe: left toggles read/unread, right toggles favorite. */
@Component({
  selector: 'rss-article-card',
  imports: [DatePipe, ProxyImgDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-card.component.html',
})
export class ArticleCardComponent {
  readonly article = input.required<Article>();

  private readonly feeds = inject(FeedsStore);
  private readonly articles = inject(ArticlesStore);
  private readonly router = inject(Router);
  private readonly gesture = new AxisGesture();
  private readonly longPress = new LongPressTimer(() => this.articles.toggle(this.article(), 'later'), TAP_SLOP);

  protected readonly ui = UI_ICONS;
  protected readonly dragX = signal(0);
  protected readonly flying = signal<Direction | null>(null);
  protected readonly dragging = signal(false);

  protected readonly offset = computed(() => {
    const fly = this.flying();
    return fly === 'left' ? -window.innerWidth : fly === 'right' ? window.innerWidth : this.dragX();
  });
  /** Share of the threshold reached, in [0, 1], for the hint shown while dragging. */
  protected readonly progress = computed(() => Math.min(1, Math.abs(this.offset()) / SWIPE_THRESHOLD));

  protected feedTitle(id: string): string {
    return this.feeds.feeds().find((f) => f.id === id)?.title ?? '';
  }

  protected onDown(event: PointerEvent): void {
    if (this.flying() || !isPrimaryPress(event)) return;
    this.gesture.start(event);
    this.longPress.start(event);
  }

  protected onMove(event: PointerEvent): void {
    const move = this.gesture.move(event);
    if (!move) return;
    this.longPress.move(event);
    if (move.started) {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      this.dragging.set(true);
    }
    if (move.axis === 'horizontal') this.dragX.set(move.dx);
  }

  protected onUp(event: PointerEvent): void {
    const end = this.gesture.end(event);
    this.longPress.cancel();
    if (!end) return;
    if (end.axis === 'horizontal') {
      this.dragging.set(false);
      if (Math.abs(end.dx) >= SWIPE_THRESHOLD) this.fling(end.dx < 0 ? 'left' : 'right');
      else this.dragX.set(0);
    } else if (end.axis === null && Math.hypot(end.dx, end.dy) < TAP_SLOP && !this.longPress.fired) {
      void this.router.navigate(['/article', this.article().id]);
    }
  }

  protected onCancel(): void {
    this.longPress.cancel();
    this.gesture.cancel();
    this.dragging.set(false);
    this.dragX.set(0);
  }

  protected fling(direction: Direction): void {
    if (this.flying()) return;
    this.flying.set(direction);
    setTimeout(() => this.commit(direction), FLY_MS);
  }

  private commit(direction: Direction): void {
    this.articles.toggle(this.article(), direction === 'left' ? 'read' : 'favorite');
    // The card stays in the list unless a filter removes it: put it back without a slide-in.
    this.dragging.set(true);
    this.flying.set(null);
    this.dragX.set(0);
    requestAnimationFrame(() => this.dragging.set(false));
  }
}
