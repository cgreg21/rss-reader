import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RssStore } from '../rss/rss.store';

@Component({
  selector: 'rss-feeds',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-head"><h1>Abonnements</h1><a class="icon-btn" routerLink="/" aria-label="Retour">←</a></div>

    <section class="panel">
      <h2>Ajouter un flux</h2>
      <form class="row" (ngSubmit)="add()">
        <input name="url" type="url" required placeholder="https://exemple.fr/rss.xml" [(ngModel)]="url">
        <select name="cat" [(ngModel)]="categoryId">
          <option [ngValue]="null">Sans catégorie</option>
          @for (c of store.categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
        </select>
        <button class="btn" type="submit" [disabled]="busy()">{{ busy() ? '…' : "S'abonner" }}</button>
      </form>
      @if (error()) { <p class="error">{{ error() }}</p> }
    </section>

    <section class="panel">
      <h2>Catégories</h2>
      <form class="row" (ngSubmit)="addCategory()">
        <input name="name" placeholder="Nouvelle catégorie" [(ngModel)]="newCategory">
        <button class="btn" type="submit">Créer</button>
      </form>
      <ul class="list">
        @for (c of store.categories(); track c.id) {
          <li><span>{{ c.name }}</span><button class="btn ghost" type="button" (click)="store.removeCategory(c.id)">Supprimer</button></li>
        }
      </ul>
    </section>

    <section class="panel">
      <h2>Flux suivis</h2>
      <ul class="list">
        @for (f of store.feeds(); track f.id) {
          <li>
            <div class="grow"><strong>{{ f.title }}</strong>
              @if (f.error) { <small class="error">{{ f.error }}</small> }</div>
            <select [ngModel]="f.categoryId" (ngModelChange)="store.setFeedCategory(f.id, $event)">
              <option [ngValue]="null">Sans catégorie</option>
              @for (c of store.categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
            <button class="btn ghost" type="button" (click)="store.removeFeed(f.id)">Se désabonner</button>
          </li>
        } @empty { <li>Aucun abonnement.</li> }
      </ul>
    </section>

    <section class="panel">
      <h2>Proxy CORS</h2>
      <p class="hint">La plupart des flux n'autorisent pas la lecture directe depuis un navigateur. L'URL du flux (encodée) est ajoutée à la fin de cette adresse ; laissez vide pour un accès direct.</p>
      <input class="wide" name="proxy" [ngModel]="store.proxy()" (ngModelChange)="store.setProxy($event)">
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
