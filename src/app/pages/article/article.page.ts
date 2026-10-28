import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { I18nService } from '../../i18n/services/i18n.service';
import { LocalDatePipe } from '../../i18n/local-date.pipe';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticlesStore } from '../../rss/stores/articles.store';
import { FeedsStore } from '../../rss/stores/feeds.store';
import { ViewStore } from '../../rss/stores/view.store';
import { UI_ICONS } from '../../ui/icons';
import { ProxyContentDirective } from '../../ui/directives/proxy-img.directive';
import { OfflineMediaService } from '../../rss/services/offline-media.service';
import { MediaSessionDirective } from '../../ui/directives/media-session.directive';
import { AudioPlayerComponent } from '../../ui/audio-player/audio-player.component';
import { ArticlesPage } from '../articles/articles.page';
import { SwipeNavigation } from './swipe-navigation';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, LocalDatePipe, TranslatePipe, NgTemplateOutlet, ArticlesPage, ProxyContentDirective, MediaSessionDirective, AudioPlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article.page.html',
  host: {
    class: 'relative block min-h-full touch-pan-y',
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
  protected readonly article = computed(() => this.store.article(this.id()));
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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

  /** Right: next article, left: previous one, down: the list; without a neighbour, back to the list. */
  protected readonly swipe = new SwipeNavigation({
    host: this.host.nativeElement,
    sign: this.i18n.sign,
    onCommit: (direction) => {
      const target = direction === 'next' ? this.neighbours().next : direction === 'previous' ? this.neighbours().previous : undefined;
      void this.router.navigate(target ? ['/article', target.id] : ['/']);
    },
  });
  /** Article revealed by the current swipe, or null when the swipe leads back to the list. */
  protected readonly target = computed(() => {
    const o = this.swipe.offset();
    return o > 0 ? this.neighbours().next : o < 0 ? this.neighbours().previous : undefined;
  });

  protected feedName(feedId: string): string {
    return this.feedsStore.feeds().find((f) => f.id === feedId)?.title ?? '';
  }

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        if (!this.order().includes(id)) {
          const ids = this.view.visible().map((a) => a.id);
          this.order.set(ids.includes(id) ? ids : [id]);
        }
        this.swipe.reset();
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
