import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';

import { SnackbarService } from '../../ui/services/snackbar.service';
import { InstallService } from '../services/install.service';
import { UpdateService } from '../services/update.service';

/** Headless: shows the "new version" or "install" offer through the snackbar. */
@Component({
  selector: 'rss-app-prompt',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class AppPromptComponent {
  private readonly snackbar = inject(SnackbarService);
  private readonly install = inject(InstallService);
  private readonly updates = inject(UpdateService);
  private shown: { kind: 'update' | 'install' | null; id: number } = { kind: null, id: 0 };

  constructor() {
    effect(() => {
      const kind = this.updates.available() && !this.updates.dismissed() ? 'update' : this.install.banner() ? 'install' : null;
      if (kind === this.shown.kind) return;
      this.snackbar.dismiss(this.shown.id);
      this.shown = { kind, id: kind ? this.present(kind) : 0 };
    });
  }

  private present(kind: 'update' | 'install'): number {
    const image = 'icons/icon-192.png';
    if (kind === 'update') {
      return this.snackbar.show('Une nouvelle version de RSS Reader est prête.', {
        kind: 'info', title: 'Mise à jour disponible', image, duration: 0,
        actions: [
          { label: 'Recharger', primary: true, run: () => this.updates.apply() },
          { label: 'Plus tard', run: () => this.updates.dismiss() },
        ],
      });
    }
    return this.snackbar.show('Accès rapide et lecture hors ligne.', {
      kind: 'info', title: "Installer l'application", image, duration: 0,
      actions: [
        { label: 'Installer', primary: true, run: () => void this.install.install() },
        { label: 'Non merci', run: () => this.install.dismiss() },
      ],
    });
  }
}
