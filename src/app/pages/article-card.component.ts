import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';

import { Article } from '../rss/models';
import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from '../ui/icons';
import { SnackbarService } from '../ui/snackbar.service';

const SWIPE_SLOP = 10;
const TAP_SLOP = 6;
const THRESHOLD = 100;
const FLY_MS = 200;

type Direction = 'left' | 'right';

/** Card with a Tinder-style swipe: left toggles read/unread, right toggles favorite. */
@Component({
  selector: 'rss-article-card',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-card.component.html',
})
export class ArticleCardComponent {
  readonly article = input.required<Article>();

  protected readonly store = inject(RssStore);
  protected readonly ui = UI_ICONS;
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);

  protected readonly dragX = signal(0);
  protected readonly flying = signal<Direction | null>(null);
  protected readonly dragging = signal(false);

  protected readonly offset = computed(() => {
    const fly = this.flying();
    return fly === 'left' ? -window.innerWidth : fly === 'right' ? window.innerWidth : this.dragX();
  });
  /** Share of the threshold reached, in [0, 1], for the hint shown while dragging. */
  protected readonly progress = computed(() => Math.min(1, Math.abs(this.offset()) / THRESHOLD));

  private pointer: { x: number; y: number; id: number; horizontal: boolean | null } | null = null;

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }

  protected onDown(event: PointerEvent): void {
    if (this.flying() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.pointer = { x: event.clientX, y: event.clientY, id: event.pointerId, horizontal: null };
  }

  protected onMove(event: PointerEvent): void {
    const p = this.pointer;
    if (!p || event.pointerId !== p.id) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (p.horizontal === null && Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_SLOP) {
      p.horizontal = Math.abs(dx) > Math.abs(dy);
      if (p.horizontal) {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        this.dragging.set(true);
      } else {
        this.pointer = null;
        return;
      }
    }
    if (p.horizontal) this.dragX.set(dx);
  }

  protected onUp(event: PointerEvent): void {
    const p = this.pointer;
    this.pointer = null;
    if (!p || event.pointerId !== p.id) return;
    const dx = event.clientX - p.x;
    const dy = event.clientY - p.y;
    if (p.horizontal) {
      this.dragging.set(false);
      if (Math.abs(dx) >= THRESHOLD) this.fling(dx < 0 ? 'left' : 'right');
      else this.dragX.set(0);
    } else if (p.horizontal === null && Math.hypot(dx, dy) < TAP_SLOP) {
      void this.router.navigate(['/article', this.article().id]);
    }
  }

  protected onCancel(): void {
    this.pointer = null;
    this.dragging.set(false);
    this.dragX.set(0);
  }

  protected fling(direction: Direction): void {
    if (this.flying()) return;
    this.flying.set(direction);
    setTimeout(() => this.commit(direction), FLY_MS);
  }

  private commit(direction: Direction): void {
    const article = this.article();
    if (direction === 'left') {
      void this.store.patch(article.id, { read: !article.read });
      this.snackbar.show(article.read ? 'Marqué comme non lu' : 'Marqué comme lu');
    } else {
      void this.store.patch(article.id, { favorite: !article.favorite });
      this.snackbar.show(article.favorite ? 'Retiré des favoris' : 'Ajouté aux favoris');
    }
    // The card stays in the list unless a filter removes it: put it back without a slide-in.
    this.dragging.set(true);
    this.flying.set(null);
    this.dragX.set(0);
    requestAnimationFrame(() => this.dragging.set(false));
  }
}
