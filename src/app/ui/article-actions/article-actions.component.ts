import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { ViewStore } from '../../rss/view.store';
import { ArticleLayout, SettingsStore } from '../../rss/settings.store';
import { DialogService } from '../services/dialog.service';
import { UI_ICONS } from '../icons';
import { RadialItem, RadialMenuComponent } from '../radial-menu/radial-menu.component';

/** Mark-all-read button and article layout selector. */
@Component({
  selector: 'rss-article-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadialMenuComponent],
  host: { class: 'flex w-full items-center justify-between gap-3 sidebar:w-auto' },
  templateUrl: './article-actions.component.html',
})
export class ArticleActionsComponent {
  readonly radial = input(false);
  protected readonly store = inject(ViewStore);
  protected readonly settings = inject(SettingsStore);
  private readonly dialog = inject(DialogService);
  protected readonly ui = UI_ICONS;
  protected readonly layouts: { id: ArticleLayout; label: string; icon: string }[] = [
    { id: 'list', label: 'Liste', icon: UI_ICONS.layoutList },
    { id: 'detail', label: 'Détail', icon: UI_ICONS.layoutDetail },
    { id: 'card', label: 'Cartes', icon: UI_ICONS.layoutCard },
  ];

  protected readonly radialItems = computed<RadialItem[]>(() => [
    { label: 'Tout marquer comme lu', icon: this.ui.markAllRead, run: () => void this.markAllRead() },
    ...this.layouts.map((l) => ({
      label: l.label, icon: l.icon, activeClass: this.settings.layout() === l.id ? '!bg-accent !text-white' : undefined,
      run: () => this.settings.layout.set(l.id),
    })),
  ]);

  protected async markAllRead(): Promise<void> {
    if (await this.dialog.confirm('Marquer tous les articles comme lus ?', { title: 'Tout marquer comme lu' })) this.store.markAllRead();
  }
}
