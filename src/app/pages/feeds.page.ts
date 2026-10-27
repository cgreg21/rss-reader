import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { UI_ICONS } from '../ui/icons';
import { FeedsTabComponent } from './options/feeds-tab.component';
import { ReadingTabComponent } from './options/reading-tab.component';
import { SyncTabComponent } from './options/sync-tab.component';
import { SystemTabComponent } from './options/system-tab.component';

/** Options page: one component per tab, plus the bottom tab bar. */
@Component({
  selector: 'rss-feeds',
  host: { class: 'block anim-fade-in' },
  imports: [FeedsTabComponent, ReadingTabComponent, SyncTabComponent, SystemTabComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feeds.page.html',
})
export class FeedsPage {
  protected readonly tabs = [
    { id: 'feeds', label: 'Flux', icon: UI_ICONS.all },
    { id: 'reading', label: 'Lecture', icon: UI_ICONS.reader },
    { id: 'sync', label: 'Synchro', icon: UI_ICONS.refresh },
    { id: 'system', label: 'Système', icon: UI_ICONS.settings },
  ] as const;
  protected readonly tab = signal<(typeof this.tabs)[number]['id']>('feeds');
}
