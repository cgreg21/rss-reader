import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';

import { MessageKey } from '../../i18n/messages';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UI_ICONS } from '../../ui/icons';
import { FeedsTabComponent } from './feeds-tab/feeds-tab.component';
import { ReadingTabComponent } from './reading-tab/reading-tab.component';
import { SyncTabComponent } from './sync-tab/sync-tab.component';
import { SystemTabComponent } from './system-tab/system-tab.component';
import { AboutPage } from '../about/about.page';

/** Options page: one component per tab, plus the bottom tab bar. */
@Component({
  selector: 'rss-options',
  host: { class: 'block' },
  imports: [FeedsTabComponent, ReadingTabComponent, SyncTabComponent, SystemTabComponent, AboutPage, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './options.page.html',
})
export class OptionsPage {
  protected readonly tabs = [
    { id: 'feeds', label: 'tabs.feeds', icon: UI_ICONS.all },
    { id: 'reading', label: 'tabs.reading', icon: UI_ICONS.reader },
    { id: 'sync', label: 'tabs.sync', icon: UI_ICONS.refresh },
    { id: 'system', label: 'tabs.system', icon: UI_ICONS.settings },
    { id: 'about', label: 'nav.about', icon: UI_ICONS.info },
  ] as const satisfies readonly { id: string; label: MessageKey; icon: string }[];
  protected readonly tab = signal<(typeof this.tabs)[number]['id']>('feeds');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Shows a tab from the top: the scrolling container is the shell's main element. */
  protected select(id: (typeof this.tabs)[number]['id']): void {
    this.tab.set(id);
    this.host.nativeElement.closest('main')?.scrollTo(0, 0);
  }
}
