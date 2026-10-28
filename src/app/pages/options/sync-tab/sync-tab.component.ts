import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LibraryService } from '../../../rss/services/library.service';
import { FeedsStore } from '../../../rss/feeds.store';
import { SyncService } from '../../../pwa/services/sync.service';
import { UI_ICONS } from '../../../ui/icons';
import { download, pickedText } from '../download';

/** Options tab: PIN-based sync and backup files. */
@Component({
  selector: 'rss-sync-tab',
  host: { class: 'block' },
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sync-tab.component.html',
})
export class SyncTabComponent {
  protected readonly store = inject(FeedsStore);
  protected readonly sync = inject(SyncService);
  private readonly library = inject(LibraryService);
  protected readonly ui = UI_ICONS;
  protected readonly message = signal('');

  protected async importBackupFile(event: Event): Promise<void> {
    const text = await pickedText(event);
    if (text === null) return;
    try {
      const { feeds } = await this.library.importBackup(text);
      this.message.set(`Sauvegarde restaurée : ${feeds} flux ajouté(s).`);
    } catch (e) {
      this.message.set(e instanceof Error ? e.message : 'Import impossible');
    }
  }

  protected exportBackupFile(): void {
    download(this.library.exportBackup(), 'application/json', 'rssreader-backup.json');
  }
}
