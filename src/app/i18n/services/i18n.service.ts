import { Injectable, computed, effect, inject } from '@angular/core';
import { formatDate } from '@angular/common';

import { SettingsStore } from '../../rss/stores/settings.store';
import { Lang, detectLang, isRtl } from '../languages';
import '../locales';
import { MessageError } from '../message-error';
import { MESSAGES, MessageKey } from '../messages';

export type Params = Record<string, string | number>;
export type DateKind = 'dateTime' | 'time';

const DATE_FORMATS: Record<DateKind, string> = { dateTime: 'short', time: 'mediumTime' };

/** Runtime translations; the language follows the browser unless the user picked one. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly settings = inject(SettingsStore);

  readonly lang = computed<Lang>(() => {
    const choice = this.settings.language();
    return choice === 'auto' ? detectLang(navigator.languages?.length ? navigator.languages : [navigator.language]) : choice;
  });
  readonly dir = computed(() => (isRtl(this.lang()) ? 'rtl' : 'ltr'));
  /** +1 in left-to-right layouts, -1 in right-to-left ones: multiplies horizontal offsets. */
  readonly sign = computed(() => (this.dir() === 'rtl' ? -1 : 1));

  constructor() {
    effect(() => {
      document.documentElement.lang = this.lang();
      document.documentElement.dir = this.dir();
    });
  }

  t(key: MessageKey, params?: Params): string {
    const text = MESSAGES[this.lang()][key] ?? MESSAGES.en[key] ?? key;
    return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;
  }

  /** Text of an error: translated for a `MessageError`, the message of any other error, else the fallback. */
  errorText(error: unknown, fallback: MessageKey = 'err.generic'): string {
    if (error instanceof MessageError) return this.t(error.key, error.params);
    return error instanceof Error ? error.message : this.t(fallback);
  }

  date(value: number | Date | null | undefined, kind: DateKind = 'dateTime'): string {
    return value == null ? '' : formatDate(value, DATE_FORMATS[kind], this.lang());
  }

  /** Byte count in the closest unit (B, kB, MB, GB), formatted for the selected language. */
  bytes(value: number): string {
    const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
    let i = 0;
    let n = Math.max(0, value);
    while (n >= 1000 && i < units.length - 1) {
      n /= 1000;
      i++;
    }
    return new Intl.NumberFormat(this.lang(), { style: 'unit', unit: units[i], maximumFractionDigits: i && n < 10 ? 1 : 0 }).format(n);
  }

  /** Locale tag for the speech synthesis. */
  readonly speechLang = computed(() => ({ fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', ar: 'ar-SA' })[this.lang()]);
}
