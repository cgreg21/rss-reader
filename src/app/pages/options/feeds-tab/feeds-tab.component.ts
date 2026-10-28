import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { MessageKey } from '../../../i18n/messages';
import { I18nService } from '../../../i18n/services/i18n.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { FeedHit, FetchService } from '../../../rss/services/fetch.service';
import { LibraryService } from '../../../rss/services/library.service';
import { Feed } from '../../../rss/models';
import { ArticlesStore } from '../../../rss/stores/articles.store';
import { FeedsStore } from '../../../rss/stores/feeds.store';
import { DialogService } from '../../../ui/dialog/dialog.service';
import { UI_ICONS } from '../../../ui/icons';
import { download, pickedText } from '../../../ui/utils/files';

/** Options tab: subscribe, search, categories and followed feeds (with OPML import / export). */
@Component({
  selector: 'rss-feeds-tab',
  host: { class: 'block' },
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feeds-tab.component.html',
})
export class FeedsTabComponent {
  protected readonly store = inject(FeedsStore);
  private readonly articlesStore = inject(ArticlesStore);
  private readonly library = inject(LibraryService);
  private readonly net = inject(FetchService);
  private readonly dialog = inject(DialogService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
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

  constructor() {
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
      this.hits.set(await this.net.searchFeeds(this.query));
      this.searched.set(true);
    } catch {
      this.hits.set([]);
      this.searchError.set(this.i18n.t(navigator.onLine ? 'feeds.searchFailed' : 'common.offline'));
    } finally {
      this.searching.set(false);
    }
  }

  protected followed(url: string): boolean {
    return this.store.feeds().some((f) => f.url === url);
  }

  private showInfo(title: string, rows: [MessageKey, string | undefined][]): void {
    const message = rows.filter(([, v]) => v).map(([k, v]) => this.i18n.t('feeds.row', { label: this.i18n.t(k), value: v ?? '' })).join('\n');
    void this.dialog.open<void>({ title, message, buttons: [{ label: this.i18n.t('common.close'), value: undefined, kind: 'primary' }], dismissValue: undefined });
  }

  protected showHitInfo(hit: FeedHit): void {
    this.showInfo(hit.title, [
      ['feeds.info.website', hit.website],
      ['feeds.info.url', hit.url],
      ['feeds.info.description', hit.description],
      ['feeds.info.subscribers', hit.subscribers?.toString()],
    ]);
  }

  protected showFeedInfo(feed: Feed): void {
    const articles = this.articlesStore.articles().filter((a) => a.feedId === feed.id);
    const latest = articles.reduce((max, a) => Math.max(max, a.published), 0);
    const date = (t: number) => this.i18n.date(t);
    this.showInfo(feed.title, [
      ['feeds.info.website', feed.siteUrl],
      ['feeds.info.url', feed.url],
      ['feeds.info.type', feed.format],
      ['feeds.info.description', feed.description],
      ['feeds.info.category', this.store.categories().find((c) => c.id === feed.categoryId)?.name],
      ['feeds.info.articles', articles.length.toString()],
      ['feeds.info.latest', latest ? date(latest) : undefined],
      ['feeds.info.lastFetched', feed.lastFetched ? date(feed.lastFetched) : undefined],
      ['err.generic', feed.error],
    ]);
  }

  protected async follow(hit: FeedHit): Promise<void> {
    this.searchError.set('');
    try {
      await this.store.addFeed(hit.url, this.categoryId, hit.image);
    } catch (e) {
      this.searchError.set(this.i18n.errorText(e, 'feeds.cannotRead'));
    }
  }

  protected async importFile(event: Event): Promise<void> {
    const text = await pickedText(event);
    if (text === null) return;
    try {
      const { added, skipped } = await this.library.importOpml(text);
      this.opmlMessage.set(this.i18n.t('feeds.opmlResult', { added, skipped }));
    } catch (e) {
      this.opmlMessage.set(this.i18n.errorText(e, 'common.importFailed'));
    }
  }

  protected exportFile(): void {
    download(this.library.exportOpml(), 'text/x-opml', 'rssreader.opml');
  }

  protected async add(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.store.addFeed(this.url, this.categoryId);
      this.url = '';
    } catch (e) {
      this.error.set(this.i18n.errorText(e, 'feeds.cannotRead'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async addCategory(): Promise<void> {
    await this.store.addCategory(this.newCategory);
    this.newCategory = '';
  }
}
