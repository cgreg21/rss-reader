import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, input, signal } from '@angular/core';

import { RssStore } from '../../rss/rss.store';
import { UI_ICONS } from '../icons';
import { RadialItem, RadialMenuComponent } from '../radial-menu/radial-menu.component';
import { SnackbarService } from '../services/snackbar.service';

/** Favorite, read later, read/unread, full text, read aloud and open-original buttons for one article. */
@Component({
  selector: 'rss-article-detail-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RadialMenuComponent],
  host: { class: 'flex items-center gap-1' },
  templateUrl: './article-detail-actions.component.html',
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
