import { Injectable, computed, inject, signal } from '@angular/core';

import { I18nService } from '../i18n/services/i18n.service';
import { ArticlesStore, startOfToday } from './articles.store';
import { FeedsStore } from './feeds.store';
import { Article } from './models';
import { SettingsStore } from './settings.store';

export type Scope =
  | { type: 'all' }
  | { type: 'today' }
  | { type: 'favorites' }
  | { type: 'later' }
  | { type: 'feed'; id: string }
  | { type: 'category'; id: string };

export type MediaFilter = 'all' | 'text' | 'audio' | 'video';

/** What the user is looking at: scope, filters and the resulting article list and feed groups. */
@Injectable({ providedIn: 'root' })
export class ViewStore {
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(I18nService);
  private readonly feedsStore = inject(FeedsStore);
  private readonly articlesStore = inject(ArticlesStore);

  readonly scope = signal<Scope>({ type: 'all' });
  readonly unreadOnly = signal(true);
  readonly search = signal('');
  readonly mediaFilter = signal<MediaFilter>('all');

  readonly scopeTitle = computed(() => {
    const s = this.scope();
    if (s.type === 'feed') return this.feedsStore.feeds().find((f) => f.id === s.id)?.title ?? '';
    if (s.type === 'category') return this.feedsStore.categories().find((c) => c.id === s.id)?.name ?? '';
    const t = this.i18n.t.bind(this.i18n);
    return { all: t('scope.all'), today: t('scope.today'), favorites: t('scope.favorites'), later: t('scope.later') }[s.type];
  });

  readonly visible = computed(() => {
    const s = this.scope();
    const unreadOnly = this.unreadOnly();
    const q = this.search().trim().toLowerCase();
    const mediaFilter = this.mediaFilter();
    const muted = this.settings.mutedWords();
    const feedIds = s.type === 'category' ? new Set(this.feedsStore.feeds().filter((f) => f.categoryId === s.id).map((f) => f.id)) : null;
    const today = startOfToday();
    const plain = (a: Article): string => `${a.title} ${a.summary} ${a.content.replace(/<[^>]*>/g, ' ')}`.toLowerCase();
    return this.articlesStore.articles()
      .filter((a) => {
        if (s.type === 'feed' && a.feedId !== s.id) return false;
        if (feedIds && !feedIds.has(a.feedId)) return false;
        if (s.type === 'today' && a.published < today) return false;
        if (s.type === 'favorites' && !a.favorite) return false;
        if (s.type === 'later' && !a.later) return false;
        if (mediaFilter !== 'all' && (a.media?.kind ?? 'text') !== mediaFilter) return false;
        if (unreadOnly && a.read && s.type !== 'favorites' && s.type !== 'later') return false;
        if (muted.length && !a.favorite && !a.later) {
          const hay = `${a.title} ${a.summary}`.toLowerCase();
          if (muted.some((w) => hay.includes(w))) return false;
        }
        return !q || plain(a).includes(q);
      })
      .sort((a, b) => b.published - a.published);
  });

  /** Feeds grouped by category; uncategorised feeds go last. */
  readonly groups = computed(() => {
    const feeds = this.feedsStore.feeds();
    const counts = this.articlesStore.unreadByFeed();
    const unreadOnly = this.unreadOnly();
    const group = (id: string | null, name: string) => {
      const list = feeds
        .filter((f) => f.categoryId === id && (!unreadOnly || (counts.get(f.id) ?? 0) > 0))
        .sort((a, b) => a.title.localeCompare(b.title));
      return { id, name, feeds: list, unread: list.reduce((n, f) => n + (counts.get(f.id) ?? 0), 0) };
    };
    const known = this.feedsStore.categories().slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => group(c.id, c.name))
      .filter((g) => !unreadOnly || g.feeds.length);
    const other = group(null, this.i18n.t('scope.other'));
    return other.feeds.length ? [...known, other] : known;
  });

  constructor() {
    this.feedsStore.onRemoved(({ kind, id }) => {
      const s = this.scope();
      if ('id' in s && s.type === kind && s.id === id) this.scope.set({ type: 'all' });
    });
  }

  async markAllRead(): Promise<void> {
    await this.articlesStore.markRead(this.visible().map((a) => a.id));
  }
}
