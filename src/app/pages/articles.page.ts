import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { CardListComponent } from './card-list.component';
import { RevealDirective } from '../ui/reveal.directive';

@Component({
  selector: 'rss-articles',
  host: { class: 'block anim-fade-in' },
  imports: [RouterLink, DatePipe, CardListComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles.page.html',
})
export class ArticlesPage {
  protected readonly store = inject(RssStore);

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
