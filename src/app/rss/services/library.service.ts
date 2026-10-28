import { Injectable, inject } from '@angular/core';

import { MessageError } from '../../i18n/message-error';
import { Category, Feed } from '../models';
import { buildOpml, parseOpml } from '../opml';
import { ArticlesStore, flagsOf, stateKey } from '../articles.store';
import { FeedsStore } from '../feeds.store';
import { newId } from '../ids';
import { RefreshService } from './refresh.service';

/** Cross-device synchronised library: article states are keyed by `stateKey`. */
export interface SyncDoc {
  feeds: { url: string; title: string; category: string | null }[];
  removed: string[];
  /** Bit flags per article: 1 read, 2 favorite, 4 later. */
  states: Record<string, number>;
}

/** Import / export of the library: OPML, JSON backup and the synchronisation document. */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly feedsStore = inject(FeedsStore);
  private readonly articlesStore = inject(ArticlesStore);
  private readonly refresh = inject(RefreshService);

  exportOpml(): string {
    return buildOpml(this.feedsStore.categories(), this.feedsStore.feeds());
  }

  async importOpml(xml: string): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    const known = new Set(this.feedsStore.feeds().map((f) => f.url));
    for (const entry of parseOpml(xml)) {
      let url: string;
      try {
        url = new URL(entry.url).href;
      } catch {
        skipped++;
        continue;
      }
      if (known.has(url)) {
        skipped++;
        continue;
      }
      known.add(url);
      this.feedsStore.noteFollowed(url);
      await this.feedsStore.putFeed({ id: newId('f'), url, title: entry.title, categoryId: await this.feedsStore.categoryIdFor(entry.category) });
      added++;
    }
    if (added) void this.refresh.refreshAll();
    return { added, skipped };
  }

  /** Feeds, categories and article states as JSON, to move the library to another device. */
  exportBackup(): string {
    const states = this.articlesStore.articles().filter((a) => flagsOf(a)).map((a) => ({ id: a.id, read: a.read, favorite: a.favorite, later: !!a.later }));
    return JSON.stringify({ version: 1, categories: this.feedsStore.categories(), feeds: this.feedsStore.feeds().map(({ error, failures, ...f }) => f), states });
  }

  async importBackup(json: string): Promise<{ feeds: number }> {
    const data = JSON.parse(json) as { categories?: Category[]; feeds?: Feed[]; states?: { id: string; read: boolean; favorite: boolean; later: boolean }[] };
    if (!Array.isArray(data.feeds)) throw new MessageError('err.invalidBackup');
    for (const c of data.categories ?? []) await this.feedsStore.putCategory(c);
    const known = new Set(this.feedsStore.feeds().map((f) => f.url));
    let feeds = 0;
    for (const f of data.feeds) {
      if (known.has(f.url)) continue;
      await this.feedsStore.putFeed(f);
      feeds++;
    }
    const states: Record<string, number> = {};
    for (const s of data.states ?? []) states[stateKey(s.id)] = flagsOf(s);
    await this.articlesStore.applyFlags(states);
    await this.refresh.refreshAll();
    return { feeds };
  }

  buildSyncDoc(): SyncDoc {
    const categories = new Map(this.feedsStore.categories().map((c) => [c.id, c.name]));
    const states: Record<string, number> = {};
    for (const a of this.articlesStore.articles()) if (flagsOf(a)) states[stateKey(a.id)] = flagsOf(a);
    return {
      feeds: this.feedsStore.feeds().map((f) => ({ url: f.url, title: f.title, category: f.categoryId ? categories.get(f.categoryId) ?? null : null })),
      removed: this.feedsStore.removedFeeds(),
      states,
    };
  }

  /** Merges a remote document into the local library: feeds and states are unions, removals win. */
  async applySyncDoc(doc: SyncDoc): Promise<void> {
    const removed = new Set([...this.feedsStore.removedFeeds(), ...(doc.removed ?? []).filter((u) => !this.feedsStore.wasReadded(u))]);
    for (const f of this.feedsStore.feeds().filter((x) => removed.has(x.url))) await this.feedsStore.dropFeed(f.id);
    this.feedsStore.removedFeeds.set([...removed]);
    for (const remote of doc.feeds ?? []) {
      if (removed.has(remote.url) || this.feedsStore.feeds().some((f) => f.url === remote.url)) continue;
      await this.feedsStore.putFeed({ id: newId('f'), url: remote.url, title: remote.title, categoryId: await this.feedsStore.categoryIdFor(remote.category) });
    }
    await this.articlesStore.applyFlags(doc.states ?? {});
  }
}
