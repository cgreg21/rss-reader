import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';
import { SettingsStore } from '../rss/settings.store';
import { Article } from '../rss/models';
import { CardListComponent } from './card-list.component';
import { RevealDirective } from '../ui/reveal.directive';
import { ProxyImgDirective } from '../ui/proxy-img.directive';
import { LongPressDirective } from '../ui/long-press.directive';
import { SwipeActionsDirective } from '../ui/swipe-actions.directive';
import { UI_ICONS } from '../ui/icons';
import { SnackbarService } from '../ui/snackbar.service';

@Component({
  selector: 'rss-articles',
  host: { class: 'block anim-fade-in' },
  imports: [RouterLink, DatePipe, CardListComponent, RevealDirective, ProxyImgDirective, LongPressDirective, SwipeActionsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles.page.html',
})
export class ArticlesPage {
  protected readonly store = inject(RssStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly ui = UI_ICONS;
  private readonly snackbar = inject(SnackbarService);

  protected toggleRead(a: Article): void {
    void this.store.patch(a.id, { read: !a.read });
    this.snackbar.show(a.read ? 'Marqué comme non lu' : 'Marqué comme lu');
  }

  protected toggleFavorite(a: Article): void {
    void this.store.patch(a.id, { favorite: !a.favorite });
    this.snackbar.show(a.favorite ? 'Retiré des favoris' : 'Ajouté aux favoris');
  }

  protected toggleLater(a: Article): void {
    void this.store.patch(a.id, { later: !a.later });
    this.snackbar.show(a.later ? 'Retiré de À lire plus tard' : 'Ajouté à À lire plus tard');
  }

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
