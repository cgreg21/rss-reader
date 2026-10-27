import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, signal } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { UI_ICONS } from './icons';
import { SnackbarService } from './snackbar.service';

/** Favorite, read later, read/unread, full text, read aloud and open-original buttons for one article. */
@Component({
  selector: 'rss-article-detail-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex items-center gap-1' },
  template: `
    @if (article(); as a) {
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
      }
    }
  `,
})
export class ArticleDetailActionsComponent implements OnDestroy {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  private readonly snackbar = inject(SnackbarService);
  protected readonly ui = UI_ICONS;
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly loading = signal(false);
  protected readonly speaking = signal(false);
  protected readonly speechSupported = 'speechSynthesis' in window;

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
