import { describe, expect, it } from 'vitest';

import ar from './ar.json';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import ja from './ja.json';
import { LANGUAGES, LANGUAGE_NAMES, detectLang, isRtl } from './languages';
import { MESSAGES } from './messages';
import { MessageError } from './message-error';

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
const dictionaries = { en, es, de, ar, ja } as Record<string, Record<string, string>>;

describe('dictionaries', () => {
  const reference = fr as Record<string, string>;

  it('registers every language', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual([...LANGUAGES].sort());
    expect(Object.keys(LANGUAGE_NAMES)).toEqual([...LANGUAGES]);
  });

  for (const [name, dict] of Object.entries(dictionaries)) {
    it(`${name} has the keys and placeholders of fr`, () => {
      expect(Object.keys(dict).sort()).toEqual(Object.keys(reference).sort());
      for (const key of Object.keys(reference)) {
        expect(dict[key].trim(), `${name}:${key}`).not.toBe('');
        expect(placeholders(dict[key]), `${name}:${key}`).toEqual(placeholders(reference[key]));
      }
    });
  }
});

describe('languages', () => {
  it('detects the primary subtag', () => {
    expect(detectLang(['en-GB'])).toBe('en');
    expect(detectLang(['zz', 'AR-EG'])).toBe('ar');
    expect(detectLang(['ja-JP'])).toBe('ja');
    expect(detectLang([])).toBe('en');
  });

  it('knows right-to-left languages', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('fr')).toBe(false);
  });

  it('MessageError carries its key and params', () => {
    const e = new MessageError('err.invalidFeed', { n: 1 });
    expect(e.message).toBe('err.invalidFeed');
    expect(e.params).toEqual({ n: 1 });
  });
});
