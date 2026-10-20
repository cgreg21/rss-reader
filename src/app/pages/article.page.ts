import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-article',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (article(); as a) {
      <article class="reader">
        <div class="reader-bar">
          <a class="icon-btn" routerLink="/" aria-label="Retour">←</a>
          <span class="spacer"></span>
          <button class="icon-btn" type="button" [attr.aria-label]="a.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'"
            (click)="store.patch(a.id, { favorite: !a.favorite })">{{ a.favorite ? '★' : '☆' }}</button>
          <button class="icon-btn" type="button" aria-label="Basculer lu / non lu"
            (click)="store.patch(a.id, { read: !a.read })">{{ a.read ? '○' : '●' }}</button>
          @if (a.link) { <a class="icon-btn" [href]="a.link" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir l'original">↗</a> }
        </div>
        <h1>{{ a.title }}</h1>
        <p class="meta">{{ feedTitle() }} · {{ a.published | date: 'dd/MM/yyyy HH:mm' }}</p>
        @if (a.content) { <div class="body" [innerHTML]="a.content"></div> } @else { <p>{{ a.summary }}</p> }
      </article>
    } @else {
      <p class="empty"><a routerLink="/">Article introuvable.</a></p>
    }
  `,
})
export class ArticlePage {
  readonly id = input.required<string>();
  protected readonly store = inject(RssStore);
  private readonly router = inject(Router);
  protected readonly article = computed(() => this.store.article(this.id()));
  protected readonly feedTitle = computed(() => this.store.feeds().find((f) => f.id === this.article()?.feedId)?.title ?? '');

  constructor() {
    effect(() => {
      const a = this.article();
      if (a && !a.read) void this.store.patch(a.id, { read: true });
    });
  }
}
