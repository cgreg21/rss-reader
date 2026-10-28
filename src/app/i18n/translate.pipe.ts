import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService, Params } from './services/i18n.service';
import { MessageKey } from './messages';

/** Impure so it re-reads the language signal on every check; templates stay reactive under OnPush. */
@Pipe({ name: 'translate', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: MessageKey, params?: Params): string {
    return this.i18n.t(key, params);
  }
}
