import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from './services/i18n.service';

/** Byte count in a readable unit, in the selected language. */
@Pipe({ name: 'bytes', pure: false })
export class BytesPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number): string {
    return this.i18n.bytes(value);
  }
}
