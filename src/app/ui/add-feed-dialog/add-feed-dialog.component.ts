import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '../../i18n/services/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { FeedsStore } from '../../rss/stores/feeds.store';
import { FeedHit, FetchService } from '../../rss/services/fetch.service';
import { UI_ICONS } from '../icons';
import { ProxyImgDirective } from '../directives/proxy-img.directive';
import { AddFeedDialogService } from './add-feed-dialog.service';

/** Modal with a single field: a pasted URL subscribes directly, any other text searches feeds. */
@Component({
  selector: 'rss-add-feed-dialog',
  imports: [FormsModule, TranslatePipe, ProxyImgDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './add-feed-dialog.component.html',
})
export class AddFeedDialogComponent {
  protected readonly dialog = inject(AddFeedDialogService);
  private readonly store = inject(FeedsStore);
  private readonly net = inject(FetchService);
  private readonly i18n = inject(I18nService);
  protected readonly ui = UI_ICONS;
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected text = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly hits = signal<FeedHit[]>([]);
  protected readonly searched = signal(false);
  protected readonly tab = signal<'all' | FeedHit['kind']>('all');
  protected readonly counts = computed(() => {
    const all = this.hits();
    return (['text', 'audio', 'video'] as const)
      .map((kind) => ({ kind, count: all.filter((h) => h.kind === kind).length }))
      .filter((t) => t.count > 0);
  });
  protected readonly shown = computed(() => (this.tab() === 'all' ? this.hits() : this.hits().filter((h) => h.kind === this.tab())));
  protected readonly kindIcon = { text: UI_ICONS.mediaText, audio: UI_ICONS.mediaAudio, video: UI_ICONS.mediaVideo };

  constructor() {
    effect(() => {
      const input = this.field();
      if (!input) return;
      this.text = '';
      this.error.set('');
      this.hits.set([]);
      this.searched.set(false);
      setTimeout(() => input.nativeElement.focus());
    });
  }

  protected followed(url: string): boolean {
    return this.store.feeds().some((f) => f.url === url);
  }

  protected async submit(): Promise<void> {
    const value = this.text.trim();
    if (!value || this.busy()) return;
    this.field()?.nativeElement.blur();
    this.busy.set(true);
    this.error.set('');
    try {
      if (/^https?:\/\//i.test(value)) {
        await this.store.addFeed(value, null);
        this.dialog.close();
      } else {
        this.hits.set(await this.net.searchFeeds(value));
        this.tab.set('all');
        this.searched.set(true);
      }
    } catch (e) {
      this.error.set(this.i18n.errorText(e, /^https?:\/\//i.test(value) ? 'feeds.cannotRead' : navigator.onLine ? 'feeds.searchFailed' : 'common.offline'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async follow(hit: FeedHit): Promise<void> {
    this.error.set('');
    try {
      await this.store.addFeed(hit.url, null, hit.image);
    } catch (e) {
      this.error.set(this.i18n.errorText(e, 'feeds.cannotRead'));
    }
  }
}
