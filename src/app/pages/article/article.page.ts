import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { I18nService } from '../../i18n/services/i18n.service';
import { LocalDatePipe } from '../../i18n/local-date.pipe';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticlesStore } from '../../rss/stores/articles.store';
import { FeedsStore } from '../../rss/stores/feeds.store';
import { SettingsStore } from '../../rss/stores/settings.store';
import { ArticleNavigationService } from '../../rss/services/article-navigation.service';
import { UI_ICONS } from '../../ui/icons';
import { ProxyContentDirective } from '../../ui/directives/proxy-img.directive';
import { OfflineMediaService } from '../../rss/services/offline-media.service';
import { FullTextService } from '../../rss/services/full-text.service';
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
  private readonly nav = inject(ArticleNavigationService);
  private readonly settings = inject(SettingsStore);
  protected readonly i18n = inject(I18nService);
  protected readonly ui = UI_ICONS;
  protected readonly offline = inject(OfflineMediaService);
  protected readonly fullText = inject(FullTextService);
  protected readonly article = computed(() => this.store.article(this.id()));
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Invidious and Piped both serve `/embed/<id>` like YouTube, and play without ads. */
  protected youtube(videoId: string): SafeResourceUrl {
    const origin = this.settings.activeVideoFrontend() || 'https://www.youtube-nocookie.com';
    return this.sanitizer.bypassSecurityTrustResourceUrl(`${origin}/embed/${encodeURIComponent(videoId)}`);
  }
  /** Right: next article, left: previous one, down: the list; without a neighbour, back to the list. */
  protected readonly swipe = new SwipeNavigation({
    host: this.host.nativeElement,
    sign: this.i18n.sign,
    onCommit: (direction) => {
      const target = direction === 'next' ? this.nav.next() : direction === 'previous' ? this.nav.previous() : undefined;
      void this.router.navigate(target ? ['/article', target.id] : ['/']);
    },
  });
  /** Article revealed by the current swipe, or null when the swipe leads back to the list. */
  protected readonly target = computed(() => {
    const o = this.swipe.offset();
    return o > 0 ? this.nav.next() : o < 0 ? this.nav.previous() : undefined;
  });

  protected feedName(feedId: string): string {
    return this.feedsStore.feeds().find((f) => f.id === feedId)?.title ?? '';
  }

  constructor() {
    inject(DestroyRef).onDestroy(() => this.nav.close());
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.nav.open(id);
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
