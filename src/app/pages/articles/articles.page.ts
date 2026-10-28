import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { LocalDatePipe } from '../../i18n/local-date.pipe';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticlesStore } from '../../rss/articles.store';
import { FeedsStore } from '../../rss/feeds.store';
import { SettingsStore } from '../../rss/settings.store';
import { ViewStore } from '../../rss/view.store';
import { CardListComponent } from '../card-list/card-list.component';
import { RevealDirective } from '../../ui/directives/reveal.directive';
import { ProxyImgDirective } from '../../ui/directives/proxy-img.directive';
import { LongPressDirective } from '../../ui/directives/long-press.directive';
import { SwipeActionsDirective } from '../../ui/directives/swipe-actions.directive';
import { UI_ICONS, mediaIcon } from '../../ui/icons';

@Component({
  selector: 'rss-articles',
  host: { class: 'block anim-fade-in' },
  imports: [RouterLink, LocalDatePipe, TranslatePipe, NgTemplateOutlet, CardListComponent, RevealDirective, ProxyImgDirective, LongPressDirective, SwipeActionsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles.page.html',
})
export class ArticlesPage {
  protected readonly view = inject(ViewStore);
  protected readonly articles = inject(ArticlesStore);
  protected readonly feedsStore = inject(FeedsStore);
  protected readonly settings = inject(SettingsStore);
  protected readonly ui = UI_ICONS;
  protected readonly mediaIcon = mediaIcon;

  protected feedTitle(id: string): string {
    return this.feedsStore.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
