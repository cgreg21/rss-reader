import { Injectable, inject, signal } from '@angular/core';

import { I18nService } from '../../i18n/services/i18n.service';
import { SnackbarService } from '../../ui/snackbar/snackbar.service';
import { ArticlesStore } from '../stores/articles.store';

/** Loads an article's full text with user feedback; the loading state is shared by every button that triggers it. */
@Injectable({ providedIn: 'root' })
export class FullTextService {
  private readonly store = inject(ArticlesStore);
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(I18nService);
  private readonly pending = signal<string | null>(null);

  loading(id: string): boolean {
    return this.pending() === id;
  }

  async load(id: string): Promise<void> {
    if (this.pending()) return;
    this.pending.set(id);
    try {
      await this.store.fetchFullText(id);
      this.snackbar.show(this.i18n.t('detail.fullTextLoaded'));
    } catch (error) {
      this.snackbar.error(this.i18n.errorText(error, 'detail.loadFailed'));
    } finally {
      this.pending.set(null);
    }
  }
}
