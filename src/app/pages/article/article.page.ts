import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { I18nService } from '../../i18n/services/i18n.service';
import { LocalDatePipe } from '../../i18n/local-date.pipe';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticlesStore } from '../../rss/articles.store';
import { FeedsStore } from '../../rss/feeds.store';
import { ViewStore } from '../../rss/view.store';
import { UI_ICONS } from '../../ui/icons';
import { ProxyContentDirective } from '../../ui/directives/proxy-img.directive';
import { OfflineMediaService } from '../../rss/services/offline-media.service';
import { SnackbarService } from '../../ui/services/snackbar.service';
import { MediaSessionDirective } from '../../ui/directives/media-session.directive';
import { ArticlesPage } from '../articles/articles.page';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, LocalDatePipe, TranslatePipe, NgTemplateOutlet, ArticlesPage, ProxyContentDirective, MediaSessionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article.page.html',
  host: {
    class: 'relative block min-h-full touch-pan-y anim-fade-in',
  },
})
export class ArticlePage {
  readonly id = input.required<string>();
  protected readonly store = inject(ArticlesStore);
  private readonly feedsStore = inject(FeedsStore);
  private readonly view = inject(ViewStore);
  protected readonly i18n = inject(I18nService);
  protected readonly ui = UI_ICONS;
  protected readonly offline = inject(OfflineMediaService);
  private readonly snackbar = inject(SnackbarService);
  protected readonly article = computed(() => this.store.article(this.id()));
  private readonly sanitizer = inject(DomSanitizer);

  protected async saveMedia(id: string, url: string): Promise<void> {
    try {
      await this.offline.download(id, url);
    } catch {
      this.snackbar.error(this.i18n.t('media.failed'));
    }
  }

  protected youtube(videoId: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`);
  }
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

  private swipe: { x: number; y: number; axis: 'x' | 'y' | null; atTop: boolean } | null = null;
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
    this.offsetY() > 0 ? `translateY(${this.offsetY()}px)` : this.offset() ? `translateX(${this.offset() * this.i18n.sign()}px)` : null);
  protected readonly currentShadow = computed(() =>
    this.offsetY() > 0 ? '0 -12px 24px rgba(0,0,0,.45)' : this.offset() ? `${(this.offset() > 0 ? -12 : 12) * this.i18n.sign()}px 0 24px rgba(0,0,0,.45)` : null);
  protected readonly underTransform = computed(() => {
    const y = this.offsetY();
    const progress = y > 0 ? y / this.height : Math.abs(this.offset()) / this.width;
    const shift = (1 - progress) * 80;
    const move = y > 0 ? `translateY(${-shift}px)` : `translateX(${(this.offset() > 0 ? -shift : shift) * this.i18n.sign()}px)`;
    return `${move} scale(${0.94 + 0.06 * progress})`;
  });
  protected readonly underOpacity = computed(() => 0.5 + 0.5 * (this.offsetY() > 0 ? this.offsetY() / this.height : Math.abs(this.offset()) / this.width));

  protected feedName(feedId: string): string {
    return this.feedsStore.feeds().find((f) => f.id === feedId)?.title ?? '';
  }

  /** Touch events (not pointer ones) so vertical scrolling stays native: the page only takes over horizontal
   *  moves, and a pull down when the article is already scrolled to the top. */
  private swipeStart(event: TouchEvent): void {
    if (this.animating() || event.touches.length !== 1 || (event.target as Element).closest('audio, video, iframe')) return;
    const main = this.host.nativeElement.closest('main');
    this.underTop.set(main ? main.getBoundingClientRect().top - this.host.nativeElement.getBoundingClientRect().top : 0);
    this.underHeight.set(main?.clientHeight ?? window.innerHeight);
    const t = event.touches[0];
    this.swipe = { x: t.clientX, y: t.clientY, axis: null, atTop: (main?.scrollTop ?? 0) <= 0 };
  }

  private swipeMove(event: TouchEvent): void {
    const swipe = this.swipe;
    if (!swipe) return;
    const t = event.touches[0];
    const dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (swipe.axis === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 10) {
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal || (dy > 0 && swipe.atTop)) swipe.axis = horizontal ? 'x' : 'y';
      else return void (this.swipe = null);
    }
    if (!swipe.axis) return;
    if (event.cancelable) event.preventDefault();
    if (swipe.axis === 'x') this.offset.set(dx * this.i18n.sign());
    else this.offsetY.set(Math.max(0, dy));
  }

  /** Right: next article, left: previous one, down: the list; without a neighbour, back to the list. */
  private swipeEnd(committed: boolean): void {
    const swipe = this.swipe;
    this.swipe = null;
    if (!swipe?.axis) return;
    this.animating.set(true);
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
    const el = this.host.nativeElement;
    el.addEventListener('touchstart', (e) => this.swipeStart(e), { passive: true });
    // Non-passive: preventDefault stops the native scroll once the swipe is ours.
    el.addEventListener('touchmove', (e) => this.swipeMove(e), { passive: false });
    el.addEventListener('touchend', () => this.swipeEnd(true));
    el.addEventListener('touchcancel', () => this.swipeEnd(false));
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (!this.order().includes(id)) {
          const ids = this.view.visible().map((a) => a.id);
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
