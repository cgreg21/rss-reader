import { Injectable, computed, inject, signal } from '@angular/core';

import { Article } from '../models';
import { ArticlesStore } from '../stores/articles.store';
import { ViewStore } from '../stores/view.store';

/** Previous/next article around the one being read, following the list as currently filtered and sorted. */
@Injectable({ providedIn: 'root' })
export class ArticleNavigationService {
  private readonly store = inject(ArticlesStore);
  private readonly view = inject(ViewStore);
  private readonly current = signal<string | null>(null);
  /** Snapshot of the list order, so neighbours stay stable when reading an article hides it from the list. */
  private readonly order = signal<string[]>([]);

  private readonly neighbours = computed(() => {
    const order = this.order();
    const i = this.current() ? order.indexOf(this.current()!) : -1;
    const find = (j: number): Article | undefined => (i >= 0 && order[j] ? this.store.article(order[j]) : undefined);
    return { previous: find(i - 1), next: find(i + 1) };
  });
  readonly previous = computed(() => this.neighbours().previous);
  readonly next = computed(() => this.neighbours().next);

  /** Called when an article opens; the order is re-read from the list only when the article is not part of it. */
  open(id: string): void {
    this.current.set(id);
    if (!this.order().includes(id)) {
      const ids = this.view.visible().map((a) => a.id);
      this.order.set(ids.includes(id) ? ids : [id]);
    }
  }
}
