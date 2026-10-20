import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { FeedHit, RssStore } from '../rss/rss.store';
import { PushService } from '../pwa/push.service';
import { UI_ICONS } from '../ui/icons';

@Component({
  selector: 'rss-feeds',
  host: { class: 'block anim-fade-in' },
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feeds.page.html',
})
export class FeedsPage {
  protected readonly store = inject(RssStore);
  protected readonly push = inject(PushService);
  protected readonly autoRefreshOptions = [5, 15, 30, 60];
  protected readonly ui = UI_ICONS;
  protected url = '';
  protected categoryId: string | null = null;
  protected newCategory = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly opmlMessage = signal('');

  protected query = '';
  protected readonly hits = signal<FeedHit[]>([]);
  protected readonly searching = signal(false);
  protected readonly searchError = signal('');
  protected readonly searched = signal(false);

  protected async search(): Promise<void> {
    if (!this.query.trim()) return;
    this.searching.set(true);
    this.searchError.set('');
    try {
      this.hits.set(await this.store.searchFeeds(this.query));
      this.searched.set(true);
    } catch {
      this.hits.set([]);
      this.searchError.set(navigator.onLine ? 'Recherche impossible (essayez d’activer le proxy).' : 'Hors ligne.');
    } finally {
      this.searching.set(false);
    }
  }

  protected followed(url: string): boolean {
    return this.store.feeds().some((f) => f.url === url);
  }

  protected async follow(hit: FeedHit): Promise<void> {
    this.searchError.set('');
    try {
      await this.store.addFeed(hit.url, this.categoryId);
    } catch (e) {
      this.searchError.set(e instanceof Error ? e.message : 'Impossible de lire ce flux');
    }
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { added, skipped } = await this.store.importOpml(await file.text());
      this.opmlMessage.set(`${added} flux importé(s), ${skipped} ignoré(s).`);
    } catch (e) {
      this.opmlMessage.set(e instanceof Error ? e.message : 'Import impossible');
    }
  }

  protected exportFile(): void {
    const url = URL.createObjectURL(new Blob([this.store.exportOpml()], { type: 'text/x-opml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rssreader.opml';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async add(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.addFeed(this.url, this.categoryId);
      this.url = '';
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Impossible de lire ce flux');
    } finally {
      this.busy.set(false);
    }
  }

  protected async addCategory(): Promise<void> {
    await this.store.addCategory(this.newCategory);
    this.newCategory = '';
  }
}
