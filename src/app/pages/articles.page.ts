import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { CardListComponent } from './card-list.component';

@Component({
  selector: 'rss-articles',
  imports: [RouterLink, DatePipe, CardListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles.page.html',
})
export class ArticlesPage {
  protected readonly store = inject(RssStore);

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
