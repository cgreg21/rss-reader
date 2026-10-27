import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { FeedHit, RssStore } from '../rss/rss.store';
import { Feed } from '../rss/models';
import { DialogService } from '../ui/dialog.service';
import { PushService } from '../pwa/push.service';
import { SyncService } from '../pwa/sync.service';
import { UI_ICONS } from '../ui/icons';

@Component({
  selector: 'rss-feeds',
  host: { class: 'block anim-fade-in' },
  imports: [FormsModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feeds.page.html',
})
export class FeedsPage {
  protected readonly store = inject(RssStore);
  protected readonly push = inject(PushService);
  protected readonly sync = inject(SyncService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  protected readonly autoRefreshOptions = [5, 15, 30, 60];
  protected readonly ui = UI_ICONS;
  protected readonly tabs = [
    { id: 'feeds', label: 'Flux', icon: UI_ICONS.all },
    { id: 'reading', label: 'Lecture', icon: UI_ICONS.reader },
    { id: 'sync', label: 'Synchro', icon: UI_ICONS.refresh },
    { id: 'system', label: 'Système', icon: UI_ICONS.settings },
  ] as const;
  protected readonly tab = signal<(typeof this.tabs)[number]['id']>('feeds');
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

  protected async clearImageCache(): Promise<void> {
    if (await this.dialog.confirm('Supprimer toutes les images en cache ?', { title: 'Vider le cache' })) await this.store.clearImageCache();
  }

  constructor() {
    void this.store.refreshImageCacheCount();
    // Opened from a share (Android share target, iOS shortcut) or a link: ?url=<site or feed>.
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const shared = params.get('url') ?? /https?:\/\/\S+/.exec(params.get('text') ?? '')?.[0];
      if (!shared) return;
      this.url = shared;
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      void this.add();
    });
  }

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

  private showInfo(title: string, rows: [string, string | undefined][]): void {
    const message = rows.filter(([, v]) => v).map(([k, v]) => `${k} : ${v}`).join('\n');
    void this.dialog.open<void>({ title, message, buttons: [{ label: 'Fermer', value: undefined, kind: 'primary' }], dismissValue: undefined });
  }

  protected showHitInfo(hit: FeedHit): void {
    this.showInfo(hit.title, [
      ['Site web', hit.website],
      ['Adresse du flux', hit.url],
      ['Description', hit.description],
      ['Abonnés', hit.subscribers?.toString()],
    ]);
  }

  protected showFeedInfo(feed: Feed): void {
    const articles = this.store.articles().filter((a) => a.feedId === feed.id);
    const latest = articles.reduce((max, a) => Math.max(max, a.published), 0);
    const date = (t: number) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    this.showInfo(feed.title, [
      ['Site web', feed.siteUrl],
      ['Adresse du flux', feed.url],
      ['Type', feed.format],
      ['Description', feed.description],
      ['Catégorie', this.store.categories().find((c) => c.id === feed.categoryId)?.name],
      ['Articles', articles.length.toString()],
      ['Dernier article', latest ? date(latest) : undefined],
      ['Dernière actualisation', feed.lastFetched ? date(feed.lastFetched) : undefined],
      ['Erreur', feed.error],
    ]);
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

  protected async importBackupFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const { feeds } = await this.store.importBackup(await file.text());
      this.opmlMessage.set(`Sauvegarde restaurée : ${feeds} flux ajouté(s).`);
    } catch (e) {
      this.opmlMessage.set(e instanceof Error ? e.message : 'Import impossible');
    }
  }

  protected exportBackupFile(): void {
    const url = URL.createObjectURL(new Blob([this.store.exportBackup()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rssreader-backup.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  protected readonly retentionOptions = [7, 30, 90];
  protected readonly fontSizes = [14, 15, 16, 17, 18, 20, 22];

  protected setMuted(text: string): void {
    this.store.setMutedWords(text.split('\n'));
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
