import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Article } from '../rss/models';
import { ArticleCardComponent } from './article-card.component';
import { RevealDirective } from '../ui/reveal.directive';

/** Swipeable cards laid out one under the other. */
@Component({
  selector: 'rss-card-list',
  imports: [ArticleCardComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex w-full max-w-md flex-col gap-5">
      @for (a of articles(); track a.id) { <div rssReveal><rss-article-card [article]="a" /></div> }
    </div>`,
})
export class CardListComponent {
  readonly articles = input.required<Article[]>();
}
