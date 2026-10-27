import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Article } from '../rss/models';
import { ArticleCardComponent } from './article-card.component';
import { RevealDirective } from '../ui/reveal.directive';
import { CoverflowDirective } from '../ui/coverflow.directive';

/** Swipeable cards laid out one under the other. */
@Component({
  selector: 'rss-card-list',
  imports: [ArticleCardComponent, RevealDirective, CoverflowDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div rssCoverflow class="mx-auto flex w-full max-w-md flex-col gap-5 overflow-x-clip">
      @for (a of articles(); track a.id) { <div rssReveal><div data-coverflow><rss-article-card [article]="a" /></div></div> }
    </div>`,
})
export class CardListComponent {
  readonly articles = input.required<Article[]>();
}
