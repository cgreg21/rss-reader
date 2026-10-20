import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { DrawerService } from './drawer.service';
import { UI_ICONS } from './icons';

/** Mobile/portrait header: drawer button, current scope title and refresh. */
@Component({
  selector: 'rss-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './top-bar.component.html',
})
export class TopBarComponent {
  protected readonly store = inject(RssStore);
  protected readonly drawer = inject(DrawerService);
  protected readonly ui = UI_ICONS;
}
