import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { UI_ICONS } from './icons';
import { SnackbarService } from './snackbar.service';

/** Renders the current snackbar message; place it once in the root layout. */
@Component({
  selector: 'rss-snackbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './snackbar.component.html',
})
export class SnackbarComponent {
  protected readonly snackbar = inject(SnackbarService);
  protected readonly ui = UI_ICONS;
}
