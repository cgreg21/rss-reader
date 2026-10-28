import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, signal } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from './icons';
import { RadialItem, RadialMenuComponent } from './radial-menu.component';
import { SnackbarService } from './snackbar.service';

/** Favorite, read later, read/unread, full text, read aloud and open-original buttons for one article. */
@Component({
  selector: 'rss-article-detail-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadialMenuComponent],
  host: { class: 'flex items-center gap-1' },
  template: `
    @if (radial()) {
      <rss-radial-menu [items]="radialItems()" />
    } @else if (overflow()) {
      @if (overflowItems().length) {
        <div class="relative">
          <button class="icon-btn" type="button" aria-label="Plus d'actions" aria-haspopup="menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())">{{ ui.more }}</button>
          @if (menuOpen()) {
            <div class="fixed inset-0 z-30" (click)="menuOpen.set(false)"></div>
            <div class="absolute right-0 top-full z-40 mt-1 flex flex-col gap-1 rounded-2xl bg-bg p-1 shadow-xl" role="menu">
              @for (item of overflowItems(); track item.label) {
                @if (item.href) {
                  <a class="icon-btn" role="menuitem" [href]="item.href" target="_blank" rel="noopener noreferrer" [attr.aria-label]="item.label" (click)="menuOpen.set(false)">{{ item.icon }}</a>
                } @else {
                  <button class="icon-btn" type="button" role="menuitem" [class]="item.activeClass ?? ''" [class.animate-pulse]="item.pulse" [disabled]="item.disabled"
                    [attr.aria-label]="item.label" (click)="item.run?.(); menuOpen.set(false)">{{ item.icon }}</button>
                }
              }
            </div>
          }
        </div>
      }
    } @else if (article(); as a) {
      <button class="icon-btn" type="button" [attr.aria-label]="a.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
        [class.!text-yellow-300]="a.favorite" (click)="store.patch(a.id, { favorite: !a.favorite })">{{ a.favorite ? ui.favoriteOn : ui.favorite }}</button>
      <button class="icon-btn" type="button" [attr.aria-label]="a.later ? 'Retirer de À lire plus tard' : 'Lire plus tard'"
        [class.!text-accent]="a.later" (click)="store.patch(a.id, { later: !a.later })">{{ a.later ? ui.laterOn : ui.later }}</button>
      <button class="icon-btn" type="button" aria-label="Basculer lu / non lu"
        [class.!text-green-400]="!a.read" (click)="store.patch(a.id, { read: !a.read })">{{ a.read ? ui.read : ui.unread }}</button>
      @if (a.link && !a.fullText) {
        <button class="icon-btn" type="button" aria-label="Charger le texte complet" [class.animate-pulse]="loading()" [disabled]="loading()" (click)="fullText(a.id)">{{ ui.fullText }}</button>
      }
      @if (speechSupported) {
        <button class="icon-btn" type="button" [attr.aria-label]="speaking() ? 'Arrêter la lecture' : 'Lire à voix haute'" [class.!text-accent]="speaking()"
          (click)="toggleSpeech(a.title, a.content || a.summary)">{{ speaking() ? ui.stop : ui.speak }}</button>
      }
      @if (a.link) {
        <a class="icon-btn" [href]="'https://wallhop.io/' + a.link" target="_blank" rel="noopener noreferrer" aria-label="Lire via wallhop.io">{{ ui.reader }}</a>
        <a class="icon-btn" [href]="a.link" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l'original">{{ ui.external }}</a>
        @if (canShare) { <button class="icon-btn" type="button" aria-label="Partager" (click)="share(a.title, a.link)">{{ ui.share }}</button> }
        <button class="icon-btn" type="button" aria-label="Copier le lien" (click)="copyLink(a.link)">{{ ui.copyLink }}</button>
      }
    }
  `,
})
export class ArticleDetailActionsComponent implements OnDestroy {
  readonly id = input.required<string>();
  readonly radial = input(false);
  readonly overflow = input(false);
  protected readonly menuOpen = signal(false);
  protected readonly store = inject(RssStore);
  private readonly snackbar = inject(SnackbarService);
  protected readonly ui = UI_ICONS;
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly loading = signal(false);
  protected readonly speaking = signal(false);
  protected readonly speechSupported = 'speechSynthesis' in window;

  protected readonly radialItems = computed<RadialItem[]>(() => {
    const a = this.article();
    if (!a) return [];
    return [
      { label: a.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: a.favorite ? this.ui.favoriteOn : this.ui.favorite,
        activeClass: a.favorite ? '!text-yellow-300' : undefined, run: () => this.store.patch(a.id, { favorite: !a.favorite }) },
      { label: a.later ? 'Retirer de À lire plus tard' : 'Lire plus tard', icon: a.later ? this.ui.laterOn : this.ui.later,
        activeClass: a.later ? '!text-accent' : undefined, run: () => this.store.patch(a.id, { later: !a.later }) },
      { label: 'Basculer lu / non lu', icon: a.read ? this.ui.read : this.ui.unread,
        activeClass: a.read ? undefined : '!text-green-400', run: () => this.store.patch(a.id, { read: !a.read }) },
      ...(a.link ? this.shareItems(a.title, a.link) : []),
    ];
  });

  protected readonly overflowItems = computed<RadialItem[]>(() => {
    const a = this.article();
    const items: RadialItem[] = [];
    if (!a) return items;
    if (a.link && !a.fullText) {
      items.push({ label: 'Charger le texte complet', icon: this.ui.fullText, pulse: this.loading(), disabled: this.loading(), run: () => void this.fullText(a.id) });
    }
    if (this.speechSupported) {
      items.push({ label: this.speaking() ? 'Arrêter la lecture' : 'Lire à voix haute', icon: this.speaking() ? this.ui.stop : this.ui.speak,
        activeClass: this.speaking() ? '!text-accent' : undefined, run: () => this.toggleSpeech(a.title, a.content || a.summary) });
    }
    if (a.link) {
      items.push(
        { label: 'Lire via wallhop.io', icon: this.ui.reader, href: 'https://wallhop.io/' + a.link },
        { label: "Ouvrir l'original", icon: this.ui.external, href: a.link },
      );
    }
    return items;
  });

  private shareItems(title: string, url: string): RadialItem[] {
    const items: RadialItem[] = [];
    if (this.canShare) items.push({ label: 'Partager', icon: this.ui.share, run: () => void this.share(title, url) });
    items.push({ label: 'Copier le lien', icon: this.ui.copyLink, run: () => void this.copyLink(url) });
    return items;
  }

  protected readonly canShare = typeof navigator.share === 'function';

  protected async share(title: string, url: string): Promise<void> {
    try {
      await navigator.share({ title, url });
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') this.snackbar.error('Partage impossible');
    }
  }

  protected async copyLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      this.snackbar.show('Lien copié');
    } catch {
      this.snackbar.error('Copie impossible');
    }
  }

  protected async fullText(id: string): Promise<void> {
    this.loading.set(true);
    try {
      await this.store.fetchFullText(id);
      this.snackbar.show('Texte complet chargé');
    } catch (error) {
      this.snackbar.error(error instanceof Error ? error.message : 'Chargement impossible');
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
    utterance.lang = document.documentElement.lang || 'fr-FR';
    utterance.onend = utterance.onerror = () => this.speaking.set(false);
    this.speaking.set(true);
    speechSynthesis.speak(utterance);
  }

  ngOnDestroy(): void {
    if (this.speaking()) speechSynthesis.cancel();
  }
}
