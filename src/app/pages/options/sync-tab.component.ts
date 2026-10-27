import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LibraryService } from '../../rss/library.service';
import { RssStore } from '../../rss/rss.store';
import { SyncService } from '../../pwa/sync.service';
import { UI_ICONS } from '../../ui/icons';
import { download, pickedText } from './download';

/** Options tab: PIN-based sync and backup files. */
@Component({
  selector: 'rss-sync-tab',
  host: { class: 'block' },
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="mb-2.5 flex items-center justify-between gap-3">
        <h2 class="text-base font-bold">Synchronisation</h2>
        <button class="icon-btn" type="button" aria-label="Synchroniser maintenant" [class.animate-spin]="sync.busy()" [disabled]="!sync.enabled() && !sync.stopped()" (click)="sync.resume()">{{ ui.refresh }}</button>
      </div>
      <p class="mb-2 text-[13px] text-muted">Partage abonnements, catégories et états (lu, favori, à lire plus tard) entre vos appareils via le serveur (l'adresse du proxy). Saisissez le même code PIN à 4 chiffres sur chaque appareil. Attention : 4 chiffres ne font que 10 000 combinaisons, ce code protège peu vos données.</p>
      <div class="flex flex-wrap gap-2">
        <input class="field min-w-40 flex-1" name="syncCode" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="Code PIN" [ngModel]="sync.code()" (ngModelChange)="sync.setCode($event)">
        <button class="btn-ghost" type="button" (click)="sync.generateCode()">Générer</button>
      </div>
      @if (sync.error()) { <p class="mt-2 text-sm text-red-400">{{ sync.error() }}</p> }
      @else if (sync.lastSync()) { <p class="mt-2 text-sm text-muted">Dernière synchronisation : {{ sync.lastSync() | date: 'HH:mm:ss' }}</p> }
      @else if (sync.code() && !sync.enabled()) { <p class="mt-2 text-sm text-muted">Code PIN incomplet ou adresse du proxy manquante.</p> }
    </section>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Sauvegarde / transfert</h2>
      <p class="mb-2 text-[13px] text-muted">Exporte les abonnements, catégories et états (lu, favori, à lire plus tard) vers un fichier à importer sur un autre appareil.</p>
      <div class="flex flex-wrap gap-2">
        <label class="btn cursor-pointer">Restaurer
          <input class="hidden" type="file" accept=".json,application/json" (change)="importBackupFile($event)">
        </label>
        <button class="btn-ghost" type="button" [disabled]="!store.feeds().length" (click)="exportBackupFile()">Sauvegarder</button>
      </div>
      @if (message()) { <p class="mt-2 text-sm text-muted">{{ message() }}</p> }
    </section>
  `,
})
export class SyncTabComponent {
  protected readonly store = inject(RssStore);
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
