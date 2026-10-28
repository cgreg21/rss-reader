import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, signal } from '@angular/core';

import { ArticlesStore, READER_PROXY } from '../../rss/stores/articles.store';
import { I18nService } from '../../i18n/services/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UI_ICONS } from '../icons';
import { RadialItem, RadialMenuComponent } from '../radial-menu/radial-menu.component';
import { SnackbarService } from '../snackbar/snackbar.service';

/** Favorite, read later, read/unread, full text, read aloud and open-original buttons for one article. */
@Component({
  selector: 'rss-article-detail-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadialMenuComponent, TranslatePipe],
  host: { class: 'flex items-center gap-1' },
  templateUrl: './article-detail-actions.component.html',
})
export class ArticleDetailActionsComponent implements OnDestroy {
  readonly id = input.required<string>();
  readonly radial = input(false);
  readonly overflow = input(false);
  protected readonly menuOpen = signal(false);
  protected readonly store = inject(ArticlesStore);
  private readonly snackbar = inject(SnackbarService);
  protected readonly i18n = inject(I18nService);
  protected readonly ui = UI_ICONS;
  protected readonly readerProxy = READER_PROXY;
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly loading = signal(false);
  protected readonly speaking = signal(false);
  protected readonly speechSupported = 'speechSynthesis' in window;

  protected readonly radialItems = computed<RadialItem[]>(() => {
    const a = this.article();
    const t = this.i18n.t.bind(this.i18n);
    if (!a) return [];
    return [
      { label: t(a.favorite ? 'detail.removeFavorite' : 'detail.addFavorite'), icon: a.favorite ? this.ui.favoriteOn : this.ui.favorite,
        activeClass: a.favorite ? '!text-yellow-300' : undefined, run: () => this.store.toggle(a, 'favorite') },
      { label: t(a.later ? 'detail.removeLater' : 'detail.later'), icon: a.later ? this.ui.laterOn : this.ui.later,
        activeClass: a.later ? '!text-accent' : undefined, run: () => this.store.toggle(a, 'later') },
      { label: t('detail.toggleRead'), icon: a.read ? this.ui.read : this.ui.unread,
        activeClass: a.read ? undefined : '!text-green-400', run: () => this.store.toggle(a, 'read') },
      ...(a.link ? this.shareItems(a.title, a.link) : []),
    ];
  });

  protected readonly overflowItems = computed<RadialItem[]>(() => {
    const a = this.article();
    const items: RadialItem[] = [];
    const t = this.i18n.t.bind(this.i18n);
    if (!a) return items;
    if (a.link) {
      items.push({ label: t('detail.fullText'), icon: this.ui.fullText, activeClass: a.fullText ? '!text-accent' : undefined, pulse: this.loading(), disabled: this.loading(), run: () => void this.fullText(a.id) });
    }
    if (this.speechSupported) {
      items.push({ label: t(this.speaking() ? 'detail.stopSpeech' : 'detail.speak'), icon: this.speaking() ? this.ui.stop : this.ui.speak,
        activeClass: this.speaking() ? '!text-accent' : undefined, run: () => this.toggleSpeech(a.title, a.content || a.summary) });
    }
    if (a.link) {
      items.push(
        { label: t('detail.wallhop'), icon: this.ui.reader, href: READER_PROXY + a.link },
        { label: t('detail.openOriginal'), icon: this.ui.external, href: a.link },
      );
    }
    return items;
  });

  private shareItems(title: string, url: string): RadialItem[] {
    const items: RadialItem[] = [];
    if (this.canShare) items.push({ label: this.i18n.t('detail.share'), icon: this.ui.share, run: () => void this.share(title, url) });
    items.push({ label: this.i18n.t('detail.copyLink'), icon: this.ui.copyLink, run: () => void this.copyLink(url) });
    return items;
  }

  protected readonly canShare = typeof navigator.share === 'function';

  protected async share(title: string, url: string): Promise<void> {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') this.snackbar.error(this.i18n.t('detail.shareFailed'));
    }
  }

  protected async copyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.snackbar.show(this.i18n.t('detail.linkCopied'));
    } catch {
      this.snackbar.error(this.i18n.t('detail.copyFailed'));
    }
  }

  protected async fullText(id: string): Promise<void> {
    this.loading.set(true);
    try {
      await this.store.fetchFullText(id);
      this.snackbar.show(this.i18n.t('detail.fullTextLoaded'));
    } catch (error) {
      this.snackbar.error(this.i18n.errorText(error, 'detail.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleSpeech(title: string, html: string): void {
    if (this.speaking()) {
      speechSynthesis.cancel();
      this.speaking.set(false);
      return;
    }
    const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
    const utterance = new SpeechSynthesisUtterance(`${title}. ${text}`);
    utterance.lang = this.i18n.speechLang();
    utterance.onend = utterance.onerror = () => this.speaking.set(false);
    this.speaking.set(true);
    speechSynthesis.speak(utterance);
  }

  ngOnDestroy(): void {
    if (this.speaking()) speechSynthesis.cancel();
  }
}
