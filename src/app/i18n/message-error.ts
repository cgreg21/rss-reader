import { MessageKey } from './messages';

/** Error whose text depends on the language: translated where it is displayed (see `I18nService.errorText`). */
export class MessageError extends Error {
  constructor(readonly key: MessageKey, readonly params?: Record<string, string | number>) {
    super(key);
  }
}
