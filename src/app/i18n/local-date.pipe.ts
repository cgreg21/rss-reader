import { Pipe, PipeTransform, inject } from '@angular/core';

import { DateKind, I18nService } from './services/i18n.service';

/** Date in the format of the selected language. */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | Date | null | undefined, kind: DateKind = 'dateTime'): string {
    return this.i18n.date(value, kind);
  }
}
