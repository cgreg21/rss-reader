import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { ArticleNavigationService } from '../../rss/services/article-navigation.service';
import { UI_ICONS } from '../icons';

/** Desktop previous/next pill shown at the bottom of an article, following the list as currently filtered. */
@Component({
  selector: 'rss-article-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  host: { class: 'pointer-events-none absolute inset-x-0 bottom-6 z-20 hidden justify-center sidebar:flex' },
  template: `
    <nav class="pointer-events-auto flex items-center gap-1 rounded-full bg-side p-1 shadow-xl ring-1 ring-line">
      @if (nav.previous(); as p) {
        <a class="icon-btn rtl:-scale-x-100" [routerLink]="['/article', p.id]" [attr.aria-label]="('common.previous' | translate) + ' · ' + p.title">{{ ui.previous }}</a>
      } @else {
        <span class="icon-btn pointer-events-none opacity-30 rtl:-scale-x-100" aria-hidden="true">{{ ui.previous }}</span>
      }
      @if (nav.next(); as n) {
        <a class="icon-btn rtl:-scale-x-100" [routerLink]="['/article', n.id]" [attr.aria-label]="('common.next' | translate) + ' · ' + n.title">{{ ui.next }}</a>
      } @else {
        <span class="icon-btn pointer-events-none opacity-30 rtl:-scale-x-100" aria-hidden="true">{{ ui.next }}</span>
      }
    </nav>
  `,
})
export class ArticleNavComponent {
  protected readonly nav = inject(ArticleNavigationService);
  protected readonly ui = UI_ICONS;
}
