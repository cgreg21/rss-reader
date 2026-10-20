import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-articles',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head">
      <h1>{{ store.scopeTitle() }} <small>({{ store.unreadTotal() }} non lus)</small></h1>
      <button class="icon-btn" type="button" aria-label="Tout marquer comme lu" (click)="store.markAllRead()">✓</button>
      <input class="search" type="search" placeholder="Rechercher" [value]="store.search()"
        (input)="store.search.set($any($event.target).value)">
    </div>

    @if (!store.visible().length) {
      <p class="empty">
        @if (!store.feeds().length) { Aucun flux. <a routerLink="/feeds">Ajoutez votre premier abonnement.</a> }
        @else { Aucun article à afficher. }
      </p>
    }

    <div class="grid">
      @for (a of store.visible(); track a.id) {
        <a class="card" [class.read]="a.read" [routerLink]="['/article', a.id]">
          @if (a.image) { <img [src]="a.image" alt="" loading="lazy" (error)="$any($event.target).remove()"> }
          @else { <div class="ph"></div> }
          <h2>{{ a.title }}</h2>
          <p>{{ a.summary }}</p>
          <footer>
            <span>{{ a.read ? '' : '● ' }}{{ a.published | date: 'dd/MM HH:mm' }}</span>
            <span>{{ feedTitle(a.feedId) }}</span>
          </footer>
        </a>
      }
    </div>
  `,
})
export class ArticlesPage {
  protected readonly store = inject(RssStore);

  protected feedTitle(id: string): string {
    return this.store.feeds().find((f) => f.id === id)?.title ?? '';
  }
}
