import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import ja from './ja.json';
import { Lang } from './languages';

/** `fr.json` is the reference: the other files must provide exactly its keys (checked by the type below). */
export type MessageKey = keyof typeof fr;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<Lang, Messages> = { fr, en, es, de, ar, ja };
