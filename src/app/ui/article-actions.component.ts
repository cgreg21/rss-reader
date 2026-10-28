import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { ArticleLayout, SettingsStore } from '../rss/settings.store';
import { DialogService } from './dialog.service';
import { UI_ICONS } from './icons';
import { RadialItem, RadialMenuComponent } from './radial-menu.component';

/** Mark-all-read button and article layout selector. */
@Component({
  selector: 'rss-article-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadialMenuComponent],
  host: { class: 'flex w-full items-center justify-between gap-3 sidebar:w-auto' },
  template: `
    @if (radial()) {
      <rss-radial-menu [items]="radialItems()" />
    } @else {
      <button class="icon-btn" type="button" aria-label="Tout marquer comme lu" (click)="markAllRead()">{{ ui.markAllRead }}</button>
      <div class="flex rounded-full bg-side p-0.5 sidebar:bg-bg" role="group" aria-label="Mise en page">
        @for (l of layouts; track l.id) {
          <button class="icon-btn !size-9 !min-w-9" type="button" [attr.aria-label]="l.label" [attr.aria-pressed]="settings.layout() === l.id"
            [class]="settings.layout() === l.id ? 'bg-accent !text-white' : ''" (click)="settings.layout.set(l.id)">{{ l.icon }}</button>
        }
      </div>
    }
  `,
})
export class ArticleActionsComponent {
  readonly radial = input(false);
  protected readonly store = inject(RssStore);
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
