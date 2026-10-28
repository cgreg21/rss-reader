import { Injectable, computed, effect } from '@angular/core';

import { LANG_SETTINGS, LangSetting } from '../i18n/languages';
import { flag, json, num, oneOf, persisted, text } from './persisted';

export type Theme = 'dark' | 'light';
export type ArticleLayout = 'list' | 'detail' | 'card';

/** The proxy relays the path as is, so only its origin matters; an invalid value means no proxy. */
export const proxyOrigin = (value: string): string => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : '';
  } catch {
    return '';
  }
};

/** User preferences, persisted per device. */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  readonly proxy = persisted('rssreader:caldav-proxy', text());
  readonly proxyEnabled = persisted('rssreader:proxy-enabled', flag(true));
  /** Origin of the proxy to use, or '' when disabled or invalid. */
  readonly activeProxy = computed(() => (this.proxyEnabled() ? proxyOrigin(this.proxy()) : ''));
  readonly layout = persisted<ArticleLayout>('rssreader:layout', oneOf(['list', 'detail', 'card'], 'detail'));
  /** Minutes between automatic refreshes while online; 0 disables it. */
  readonly autoRefresh = persisted('rssreader:auto-refresh', num(15));
  /** One muted word or phrase per entry; matching articles are hidden. */
  readonly mutedWords = persisted('rssreader:muted-words', json<string[]>([]));
  /** Read, non-favorite articles older than this many days are purged; 0 keeps everything. */
  readonly retentionDays = persisted('rssreader:retention-days', num(0));
  /** Saves new podcast episodes on the device in the background. */
  readonly autoDownloadPodcasts = persisted('rssreader:auto-download-podcasts', flag(false));
  readonly fontSize = persisted('rssreader:font-size', num(17));
  readonly theme = persisted<Theme>('rssreader:theme', oneOf(['dark', 'light'], 'dark'));
  /** 'auto' follows the browser language. */
  readonly language = persisted<LangSetting>('rssreader:language', oneOf(LANG_SETTINGS, 'auto'));

  constructor() {
    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      document.documentElement.style.setProperty('--body-size', `${this.fontSize() || 17}px`);
    });
  }

  setProxy(value: string): void {
    this.proxy.set(value.trim());
  }

  setMutedWords(words: string[]): void {
    this.mutedWords.set(words.map((w) => w.trim().toLowerCase()).filter(Boolean));
  }
}
