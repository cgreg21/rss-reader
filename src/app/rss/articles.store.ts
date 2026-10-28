import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import { SnackbarService } from '../ui/services/snackbar.service';
import { db } from './db';
import { extractReadable } from './feed-parser';
import { Article, ParsedFeed } from './models';
import { FetchService } from './services/fetch.service';
import { SettingsStore } from './settings.store';

export type ArticleFlag = 'read' | 'favorite' | 'later';

const MAX_ARTICLES_PER_FEED = 100;

const MESSAGES: Record<ArticleFlag, { on: string; off: string }> = {
  read: { on: 'Marqué comme lu', off: 'Marqué comme non lu' },
  favorite: { on: 'Ajouté aux favoris', off: 'Retiré des favoris' },
  later: { on: 'Ajouté à À lire plus tard', off: 'Retiré de À lire plus tard' },
};

const toPlainLength = (html: string): number => html.replace(/<[^>]*>/g, '').trim().length;
export const startOfToday = (): number => new Date().setHours(0, 0, 0, 0);

/** Article state key shared across devices: the feed-independent part of the article id. */
export const stateKey = (articleId: string): string => articleId.slice(articleId.indexOf(':') + 1);
/** Bit flags: 1 read, 2 favorite, 4 later. */
export const flagsOf = (a: Pick<Article, 'read' | 'favorite' | 'later'>): number => (a.read ? 1 : 0) | (a.favorite ? 2 : 0) | (a.later ? 4 : 0);
const withFlags = (a: Article, flags: number): Article => ({ ...a, read: !!(flags & 1), favorite: !!(flags & 2), later: !!(flags & 4) });

/** Articles of the local library (IndexedDB): state flags, retention and full-text extraction. */
@Injectable({ providedIn: 'root' })
export class ArticlesStore {
  private readonly settings = inject(SettingsStore);
  private readonly net = inject(FetchService);
  private readonly snackbar = inject(SnackbarService);

  readonly articles = signal<Article[]>([]);

  readonly unreadByFeed = computed(() => {
    const counts = new Map<string, number>();
    for (const a of this.articles()) if (!a.read) counts.set(a.feedId, (counts.get(a.feedId) ?? 0) + 1);
    return counts;
  });
  readonly unreadTotal = computed(() => this.articles().filter((a) => !a.read).length);
  readonly unreadToday = computed(() => {
    const today = startOfToday();
    return this.articles().filter((a) => !a.read && a.published >= today).length;
  });
  readonly favoriteCount = computed(() => this.articles().filter((a) => a.favorite).length);
  readonly laterCount = computed(() => this.articles().filter((a) => a.later).length);

  /** Flags received from sync or a backup, also applied to articles downloaded later. */
  private knownFlags: Record<string, number> = {};

  constructor() {
    effect(() => {
      this.settings.retentionDays();
      untracked(() => void this.purge());
    });
  }

  async load(): Promise<void> {
    this.articles.set(await db.all<Article>('articles'));
  }

  article(id: string): Article | undefined {
    return this.articles().find((a) => a.id === id);
  }

  async patch(id: string, changes: Partial<Pick<Article, ArticleFlag>>): Promise<void> {
    const article = this.article(id);
    if (!article) return;
    const updated = { ...article, ...changes };
    this.articles.update((l) => l.map((a) => (a.id === id ? updated : a)));
    await db.put('articles', updated);
  }

  /** Flips one flag of the article and tells the user. */
  toggle(article: Pick<Article, 'id' | ArticleFlag>, flag: ArticleFlag): void {
    const on = !article[flag];
    void this.patch(article.id, { [flag]: on });
    this.snackbar.show(MESSAGES[flag][on ? 'on' : 'off']);
  }

  async markRead(ids: string[]): Promise<void> {
    const wanted = new Set(ids);
    const changed = this.articles().filter((a) => wanted.has(a.id) && !a.read).map((a) => ({ ...a, read: true }));
    const done = new Set(changed.map((a) => a.id));
    this.articles.update((l) => l.map((a) => (done.has(a.id) ? { ...a, read: true } : a)));
    await db.putMany('articles', changed);
  }

  async purge(): Promise<void> {
    const days = this.settings.retentionDays();
    if (days <= 0) return;
    const limit = Date.now() - days * 86_400_000;
    await this.removeWhere((a) => a.read && !a.favorite && !a.later && a.published < limit);
  }

  /** Removes the articles of a feed. */
  async removeFeed(feedId: string): Promise<void> {
    await this.removeWhere((a) => a.feedId === feedId);
  }

  /** Merges (OR) state flags keyed by `stateKey` into current articles, and remembers them for articles not downloaded yet. */
  async applyFlags(states: Record<string, number>): Promise<void> {
    this.knownFlags = { ...this.knownFlags, ...states };
    const changed: Article[] = [];
    const next = this.articles().map((a) => {
      const merged = flagsOf(a) | (states[stateKey(a.id)] ?? 0);
      if (merged === flagsOf(a)) return a;
      const updated = withFlags(a, merged);
      changed.push(updated);
      return updated;
    });
    if (!changed.length) return;
    this.articles.set(next);
    await db.putMany('articles', changed);
  }

  /** Downloads the article's web page and replaces its content with the extracted full text. */
  async fetchFullText(id: string): Promise<void> {
    const article = this.article(id);
    if (!article?.link) throw new Error("Pas d'adresse d'origine");
    const content = extractReadable(await this.net.download(article.link), article.link);
    if (toPlainLength(content) < 200) throw new Error('Texte complet introuvable');
    const updated = { ...article, content, fullText: true };
    this.articles.update((l) => l.map((a) => (a.id === id ? updated : a)));
    await db.put('articles', updated);
  }

  /** Adds the articles not already known and keeps the latest ones of the feed (plus its favorites). */
  async merge(feedId: string, items: ParsedFeed['items']): Promise<void> {
    const existing = new Set(this.articles().map((a) => a.id));
    const fresh: Article[] = items
      .filter((i) => !existing.has(i.id))
      .map((i) => withFlags({ ...i, feedId, read: false, favorite: false }, this.knownFlags[stateKey(i.id)] ?? 0));
    if (!fresh.length) return;
    await db.putMany('articles', fresh);
    const all = [...this.articles(), ...fresh];
    const stale = all
      .filter((a) => a.feedId === feedId && !a.favorite)
      .sort((a, b) => b.published - a.published)
      .slice(MAX_ARTICLES_PER_FEED);
    await db.removeMany('articles', stale.map((a) => a.id));
    const dropped = new Set(stale.map((a) => a.id));
    this.articles.set(all.filter((a) => !dropped.has(a.id)));
  }

  private async removeWhere(predicate: (a: Article) => boolean): Promise<void> {
    const stale = this.articles().filter(predicate);
    if (!stale.length) return;
    await db.removeMany('articles', stale.map((a) => a.id));
    const gone = new Set(stale.map((a) => a.id));
    this.articles.update((l) => l.filter((a) => !gone.has(a.id)));
  }
}
