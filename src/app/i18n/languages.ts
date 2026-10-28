export const LANGUAGES = ['fr', 'en', 'es', 'de', 'ar', 'ja'] as const;
export type Lang = (typeof LANGUAGES)[number];
export type LangSetting = 'auto' | Lang;
export const LANG_SETTINGS: readonly LangSetting[] = ['auto', ...LANGUAGES];

/** Each language in its own name. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  ar: 'العربية',
  ja: '日本語',
};

export const FALLBACK_LANG: Lang = 'en';

/** First browser language whose primary subtag is supported, else English. */
export function detectLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split(/[-_]/)[0];
    const match = LANGUAGES.find((l) => l === primary);
    if (match) return match;
  }
  return FALLBACK_LANG;
}

export const isRtl = (lang: Lang): boolean => lang === 'ar';
