import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { UI_ICONS } from '../icons';
import { ProxyImgDirective } from '../directives/proxy-img.directive';
import { SnackbarService } from './snackbar.service';

/** Renders the current snackbar message; place it once in the root layout. */
@Component({
  selector: 'rss-snackbar',
  imports: [ProxyImgDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './snackbar.component.html',
})
export class SnackbarComponent {
  protected readonly snackbar = inject(SnackbarService);
  protected readonly ui = UI_ICONS;
}
