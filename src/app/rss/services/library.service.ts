import { Injectable, inject } from '@angular/core';

import { Category, Feed } from '../models';
import { buildOpml, parseOpml } from '../opml';
import { RssStore, flagsOf, stateKey } from '../rss.store';

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
  private readonly store = inject(RssStore);

  exportOpml(): string {
    return buildOpml(this.store.categories(), this.store.feeds());
  }

  async importOpml(xml: string): Promise<{ added: number; skipped: number }> {
    let added = 0;
    let skipped = 0;
    const known = new Set(this.store.feeds().map((f) => f.url));
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
      this.store.noteFollowed(url);
      await this.store.putFeed({ id: this.store.newFeedId(), url, title: entry.title, categoryId: await this.store.categoryIdFor(entry.category) });
      added++;
    }
    if (added) void this.store.refreshAll();
    return { added, skipped };
  }

  /** Feeds, categories and article states as JSON, to move the library to another device. */
  exportBackup(): string {
    const states = this.store.articles().filter((a) => flagsOf(a)).map((a) => ({ id: a.id, read: a.read, favorite: a.favorite, later: !!a.later }));
    return JSON.stringify({ version: 1, categories: this.store.categories(), feeds: this.store.feeds().map(({ error, failures, ...f }) => f), states });
  }

  async importBackup(json: string): Promise<{ feeds: number }> {
    const data = JSON.parse(json) as { categories?: Category[]; feeds?: Feed[]; states?: { id: string; read: boolean; favorite: boolean; later: boolean }[] };
    if (!Array.isArray(data.feeds)) throw new Error('Sauvegarde invalide');
    for (const c of data.categories ?? []) await this.store.putCategory(c);
    const known = new Set(this.store.feeds().map((f) => f.url));
    let feeds = 0;
    for (const f of data.feeds) {
      if (known.has(f.url)) continue;
      await this.store.putFeed(f);
      feeds++;
    }
    const states: Record<string, number> = {};
    for (const s of data.states ?? []) states[stateKey(s.id)] = flagsOf(s);
    await this.store.applyFlags(states);
    await this.store.refreshAll();
    return { feeds };
  }

  buildSyncDoc(): SyncDoc {
    const categories = new Map(this.store.categories().map((c) => [c.id, c.name]));
    const states: Record<string, number> = {};
    for (const a of this.store.articles()) if (flagsOf(a)) states[stateKey(a.id)] = flagsOf(a);
    return {
      feeds: this.store.feeds().map((f) => ({ url: f.url, title: f.title, category: f.categoryId ? categories.get(f.categoryId) ?? null : null })),
      removed: this.store.removedFeeds(),
      states,
    };
  }

  /** Merges a remote document into the local library: feeds and states are unions, removals win. */
  async applySyncDoc(doc: SyncDoc): Promise<void> {
    const removed = new Set([...this.store.removedFeeds(), ...(doc.removed ?? []).filter((u) => !this.store.wasReadded(u))]);
    for (const f of this.store.feeds().filter((x) => removed.has(x.url))) await this.store.dropFeed(f.id);
    this.store.removedFeeds.set([...removed]);
    for (const remote of doc.feeds ?? []) {
      if (removed.has(remote.url) || this.store.feeds().some((f) => f.url === remote.url)) continue;
      await this.store.putFeed({ id: this.store.newFeedId(), url: remote.url, title: remote.title, categoryId: await this.store.categoryIdFor(remote.category) });
    }
    await this.store.applyFlags(doc.states ?? {});
  }
}
