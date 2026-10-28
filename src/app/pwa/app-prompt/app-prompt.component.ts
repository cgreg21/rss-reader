import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';

import { I18nService } from '../../i18n/services/i18n.service';
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
  private readonly i18n = inject(I18nService);
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
    const t = this.i18n.t.bind(this.i18n);
    if (kind === 'update') {
      return this.snackbar.show(t('prompt.updateText'), {
        kind: 'info', title: t('prompt.updateTitle'), image, duration: 0,
        actions: [
          { label: t('prompt.reload'), primary: true, run: () => this.updates.apply() },
          { label: t('prompt.later'), run: () => this.updates.dismiss() },
        ],
      });
    }
    return this.snackbar.show(t('prompt.installText'), {
      kind: 'info', title: t('prompt.installTitle'), image, duration: 0,
      actions: [
        { label: t('prompt.install'), primary: true, run: () => void this.install.install() },
        { label: t('prompt.no'), run: () => this.install.dismiss() },
      ],
    });
  }
}
