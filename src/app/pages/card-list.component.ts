import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Article } from '../rss/models';
import { ArticleCardComponent } from './article-card.component';

/** Swipeable cards laid out one under the other. */
@Component({
  selector: 'rss-card-list',
  imports: [ArticleCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col gap-5 overflow-x-clip">
      @for (a of articles(); track a.id) { <rss-article-card [article]="a" /> }
    </div>`,
})
export class CardListComponent {
  readonly articles = input.required<Article[]>();
}
