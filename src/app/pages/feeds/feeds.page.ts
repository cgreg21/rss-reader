import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { MessageKey } from '../../i18n/messages';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UI_ICONS } from '../../ui/icons';
import { FeedsTabComponent } from '../options/feeds-tab/feeds-tab.component';
import { ReadingTabComponent } from '../options/reading-tab/reading-tab.component';
import { SyncTabComponent } from '../options/sync-tab/sync-tab.component';
import { SystemTabComponent } from '../options/system-tab/system-tab.component';

/** Options page: one component per tab, plus the bottom tab bar. */
@Component({
  selector: 'rss-feeds',
  host: { class: 'block' },
  imports: [FeedsTabComponent, ReadingTabComponent, SyncTabComponent, SystemTabComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feeds.page.html',
})
export class FeedsPage {
  protected readonly tabs = [
    { id: 'feeds', label: 'tabs.feeds', icon: UI_ICONS.all },
    { id: 'reading', label: 'tabs.reading', icon: UI_ICONS.reader },
    { id: 'sync', label: 'tabs.sync', icon: UI_ICONS.refresh },
    { id: 'system', label: 'tabs.system', icon: UI_ICONS.settings },
  ] as const satisfies readonly { id: string; label: MessageKey; icon: string }[];
  protected readonly tab = signal<(typeof this.tabs)[number]['id']>('feeds');
}
