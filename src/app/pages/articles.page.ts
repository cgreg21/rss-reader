import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-articles',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap items-center gap-3">
      <h1 class="flex-1 text-xl font-bold sm:text-[22px]">{{ store.scopeTitle() }}
        <small class="text-[15px] font-normal text-muted">({{ store.unreadTotal() }} non lus)</small></h1>
      <button class="icon-btn" type="button" aria-label="Tout marquer comme lu" (click)="store.markAllRead()">✓</button>
      <input class="field order-last w-full sm:order-none sm:w-72" type="search" placeholder="Rechercher" [value]="store.search()"
        (input)="store.search.set($any($event.target).value)">
    </div>

    @if (!store.visible().length) {
      <p class="mt-16 text-center text-muted">
        @if (!store.feeds().length) { Aucun flux. <a class="text-accent" routerLink="/feeds">Ajoutez votre premier abonnement.</a> }
        @else { Aucun article à afficher. }
      </p>
    }

    <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-5 sidebar:grid-cols-3 sidebar:gap-6">
      @for (a of store.visible(); track a.id) {
        <a class="flex min-w-0 flex-col gap-2.5" [routerLink]="['/article', a.id]" [class.opacity-60]="a.read">
          @if (a.image) { <img class="aspect-[16/10] w-full rounded-xl bg-side object-cover" [src]="a.image" alt="" loading="lazy" (error)="$any($event.target).remove()"> }
          @else { <div class="aspect-[16/10] w-full rounded-xl bg-side"></div> }
          <h2 class="text-lg leading-tight font-bold sidebar:text-xl">{{ a.title }}</h2>
          <p class="line-clamp-4 flex-1 text-sm text-slate-300">{{ a.summary }}</p>
          <footer class="flex justify-between gap-2 text-xs text-accent">
            <span>{{ a.read ? '' : '● ' }}{{ a.published | date: 'dd/MM HH:mm' }}</span>
            <span class="truncate">{{ feedTitle(a.feedId) }}</span>
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
