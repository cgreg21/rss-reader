import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

import { ArticlesStore } from '../../rss/articles.store';
import { ViewStore } from '../../rss/view.store';
import { RouterLink } from '@angular/router';
import { ArticleDetailActionsComponent } from '../article-detail-actions/article-detail-actions.component';
import { ArticleActionsComponent } from '../article-actions/article-actions.component';
import { DrawerService } from '../services/drawer.service';
import { UI_ICONS } from '../icons';

/** Mobile/portrait header: drawer button, current scope title and refresh. */
@Component({
  selector: 'rss-top-bar',
  imports: [ArticleActionsComponent, ArticleDetailActionsComponent, RouterLink],
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
  /** Title of a secondary page (Options, À propos); empty on the reading pages. */
  readonly options = input('');
  protected readonly searching = signal(this.view.search() !== '');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => this.field()?.nativeElement.focus());
  }

  protected toggleSearch(): void {
    if (this.searching()) this.view.search.set('');
    this.searching.update((open) => !open);
  }
}
