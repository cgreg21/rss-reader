import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Article } from '../../rss/models';
import { ArticleCardComponent } from '../article-card/article-card.component';
import { RevealDirective } from '../../ui/directives/reveal.directive';

/** Swipeable cards laid out one under the other. */
@Component({
  selector: 'rss-card-list',
  imports: [ArticleCardComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './card-list.component.html',
})
export class CardListComponent {
  readonly articles = input.required<Article[]>();
}
