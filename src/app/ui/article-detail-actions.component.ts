import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from './icons';

/** Favorite, read/unread and open-original buttons for one article. */
@Component({
  selector: 'rss-article-detail-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-1' },
  template: `
    @if (article(); as a) {
      <button class="icon-btn" type="button" [attr.aria-label]="a.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        [class.!text-yellow-300]="a.favorite" (click)="store.patch(a.id, { favorite: !a.favorite })">{{ a.favorite ? ui.favoriteOn : ui.favorite }}</button>
      <button class="icon-btn" type="button" aria-label="Basculer lu / non lu"
        [class.!text-green-400]="!a.read" (click)="store.patch(a.id, { read: !a.read })">{{ a.read ? ui.read : ui.unread }}</button>
      @if (a.link) { <a class="icon-btn" [href]="a.link" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l'original">{{ ui.external }}</a> }
    }
  `,
})
export class ArticleDetailActionsComponent {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  protected readonly ui = UI_ICONS;
  protected readonly article = computed(() => this.store.article(this.id()));
}
