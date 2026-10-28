import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

import { MessageKey } from '../../i18n/messages';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticlesStore } from '../../rss/stores/articles.store';
import { ViewStore, MediaFilter } from '../../rss/stores/view.store';
import { RouterLink } from '@angular/router';
import { ArticleDetailActionsComponent } from '../article-detail-actions/article-detail-actions.component';
import { ArticleActionsComponent } from '../article-actions/article-actions.component';
import { DrawerService } from '../drawer-content/drawer.service';
import { UI_ICONS } from '../icons';

/** Mobile/portrait header: drawer button, current scope title and refresh. */
@Component({
  selector: 'rss-top-bar',
  imports: [ArticleActionsComponent, ArticleDetailActionsComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './top-bar.component.html',
})
export class TopBarComponent {
  protected readonly view = inject(ViewStore);
  protected readonly articles = inject(ArticlesStore);
  protected readonly drawer = inject(DrawerService);
  protected readonly ui = UI_ICONS;
  readonly actions = input(false);
  readonly articleId = input<string | null>(null);
  /** Message key of a secondary page title (Options, About); empty on the reading pages. */
  readonly options = input<MessageKey | ''>('');
  protected readonly searching = signal(this.view.search() !== '');
  protected readonly filtering = signal(false);
  protected readonly mediaOptions: { value: MediaFilter; icon: string; label: MessageKey }[] = [
    { value: 'all', icon: UI_ICONS.all, label: 'filter.all' },
    { value: 'text', icon: UI_ICONS.mediaText, label: 'filter.text' },
    { value: 'audio', icon: UI_ICONS.mediaAudio, label: 'filter.audio' },
    { value: 'video', icon: UI_ICONS.mediaVideo, label: 'filter.video' },
  ];
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => this.field()?.nativeElement.focus());
  }

  protected pick(value: MediaFilter): void {
    this.view.mediaFilter.set(value);
    this.filtering.set(false);
  }

  protected toggleSearch(): void {
    if (this.searching()) this.view.search.set('');
    this.searching.update((open) => !open);
  }
}
