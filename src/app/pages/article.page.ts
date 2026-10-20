import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article.page.html',
})
export class ArticlePage {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly feedTitle = computed(() => this.store.feeds().find((f) => f.id === this.article()?.feedId)?.title ?? '');

  constructor() {
    effect(() => {
      const a = this.article();
      if (a && !a.read) void this.store.patch(a.id, { read: true });
    });
  }
}
