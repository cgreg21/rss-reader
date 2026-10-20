import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ArticleLayout, RssStore } from '../rss/rss.store';
import { UI_ICONS } from '../ui/icons';
import { CardStackComponent } from './card-stack.component';

@Component({
  selector: 'rss-articles',
  imports: [RouterLink, DatePipe, CardStackComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles.page.html',
})
export class ArticlesPage {
  protected readonly store = inject(RssStore);
  protected readonly ui = UI_ICONS;
  protected readonly layouts: { id: ArticleLayout; label: string; icon: string }[] = [
    { id: 'list', label: 'Liste', icon: UI_ICONS.layoutList },
    { id: 'detail', label: 'Détail', icon: UI_ICONS.layoutDetail },
    { id: 'card', label: 'Cartes', icon: UI_ICONS.layoutCard },
  ];

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
