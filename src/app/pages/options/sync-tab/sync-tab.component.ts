import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '../../../i18n/services/i18n.service';
import { LocalDatePipe } from '../../../i18n/local-date.pipe';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { LibraryService } from '../../../rss/services/library.service';
import { FeedsStore } from '../../../rss/feeds.store';
import { SyncService } from '../../../pwa/services/sync.service';
import { UI_ICONS } from '../../../ui/icons';
import { download, pickedText } from '../download';

/** Options tab: PIN-based sync and backup files. */
@Component({
  selector: 'rss-sync-tab',
  host: { class: 'block' },
  imports: [FormsModule, LocalDatePipe, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-tab.component.html',
})
export class SyncTabComponent {
  protected readonly store = inject(FeedsStore);
  protected readonly sync = inject(SyncService);
  private readonly library = inject(LibraryService);
  private readonly i18n = inject(I18nService);
  protected readonly ui = UI_ICONS;
  protected readonly message = signal('');

  protected async importBackupFile(event: Event): Promise<void> {
    const text = await pickedText(event);
    if (text === null) return;
    try {
      const { feeds } = await this.library.importBackup(text);
      this.message.set(this.i18n.t('sync.restored', { feeds }));
    } catch (e) {
      this.message.set(this.i18n.errorText(e, 'common.importFailed'));
    }
  }

  protected exportBackupFile(): void {
    download(this.library.exportBackup(), 'application/json', 'rssreader-backup.json');
  }
}
