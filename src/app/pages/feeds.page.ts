import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-feeds',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex items-center gap-3"><h1 class="flex-1 text-xl font-bold sm:text-[22px]">Abonnements</h1><a class="icon-btn" routerLink="/" aria-label="Retour">←</a></div>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Ajouter un flux</h2>
      <form class="flex flex-wrap gap-2" (ngSubmit)="add()">
        <input class="field min-w-60 flex-1" name="url" type="url" required placeholder="https://exemple.fr/rss.xml" [(ngModel)]="url">
        <select class="field" name="cat" [(ngModel)]="categoryId">
          <option [ngValue]="null">Sans catégorie</option>
          @for (c of store.categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
        <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? '…' : "S'abonner" }}</button>
      </form>
      @if (error()) { <p class="mt-2 text-red-400">{{ error() }}</p> }
    </section>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Catégories</h2>
      <form class="flex flex-wrap gap-2" (ngSubmit)="addCategory()">
        <input class="field min-w-60 flex-1" name="name" placeholder="Nouvelle catégorie" [(ngModel)]="newCategory">
        <button class="btn" type="submit">Créer</button>
      </form>
      <ul class="mt-2.5">
        @for (c of store.categories(); track c.id) {
          <li class="flex flex-wrap items-center gap-2.5 border-t border-line py-2">
            <span class="min-w-0 flex-1">{{ c.name }}</span><button class="btn-ghost" type="button" (click)="store.removeCategory(c.id)">Supprimer</button>
          </li>
        }
      </ul>
    </section>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Flux suivis</h2>
      <ul>
        @for (f of store.feeds(); track f.id) {
          <li class="flex flex-wrap items-center gap-2.5 border-t border-line py-2">
            <div class="min-w-0 flex-1"><strong>{{ f.title }}</strong>
              @if (f.error) { <small class="block text-red-400">{{ f.error }}</small> }</div>
            <select class="field" [ngModel]="f.categoryId" (ngModelChange)="store.setFeedCategory(f.id, $event)">
              <option [ngValue]="null">Sans catégorie</option>
              @for (c of store.categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
            <button class="btn-ghost" type="button" (click)="store.removeFeed(f.id)">Se désabonner</button>
          </li>
        } @empty { <li>Aucun abonnement.</li> }
      </ul>
    </section>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Proxy CORS</h2>
      <p class="mb-2 text-[13px] text-muted">La plupart des flux n'autorisent pas la lecture directe depuis un navigateur. L'URL du flux (encodée) est ajoutée à la fin de cette adresse ; laissez vide pour un accès direct.</p>
      <input class="field w-full" name="proxy" [ngModel]="store.proxy()" (ngModelChange)="store.setProxy($event)">
    </section>
  `,
})
export class FeedsPage {
  protected readonly store = inject(RssStore);
  protected url = '';
  protected categoryId: string | null = null;
  protected newCategory = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');

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
