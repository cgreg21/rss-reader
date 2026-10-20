import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ArticleLayout, RssStore } from '../rss/rss.store';
import { DialogService } from './dialog.service';
import { UI_ICONS } from './icons';

/** Mark-all-read button and article layout selector. */
@Component({
  selector: 'rss-article-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full items-center justify-between gap-3 sidebar:w-auto' },
  template: `
    <button class="icon-btn" type="button" aria-label="Tout marquer comme lu" (click)="markAllRead()">{{ ui.markAllRead }}</button>
    <div class="flex rounded-full bg-side p-0.5 sidebar:bg-bg" role="group" aria-label="Mise en page">
      @for (l of layouts; track l.id) {
        <button class="icon-btn !size-9 !min-w-9" type="button" [attr.aria-label]="l.label" [attr.aria-pressed]="store.layout() === l.id"
          [class]="store.layout() === l.id ? 'bg-accent !text-white' : ''" (click)="store.setLayout(l.id)">{{ l.icon }}</button>
      }
    </div>
  `,
})
export class ArticleActionsComponent {
  protected readonly store = inject(RssStore);
  private readonly dialog = inject(DialogService);
  protected readonly ui = UI_ICONS;
  protected readonly layouts: { id: ArticleLayout; label: string; icon: string }[] = [
    { id: 'list', label: 'Liste', icon: UI_ICONS.layoutList },
    { id: 'detail', label: 'Détail', icon: UI_ICONS.layoutDetail },
    { id: 'card', label: 'Cartes', icon: UI_ICONS.layoutCard },
  ];

  protected async markAllRead(): Promise<void> {
    if (await this.dialog.confirm('Marquer tous les articles comme lus ?', { title: 'Tout marquer comme lu' })) this.store.markAllRead();
  }
}
