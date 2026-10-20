import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { InstallService } from './pwa/install.service';
import { UpdateService } from './pwa/update.service';
import { RssStore, Scope } from './rss/rss.store';

@Component({
  selector: 'rss-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header class="topbar">
        <button class="icon-btn" type="button" aria-label="Menu" (click)="menu.set(true)">☰</button>
        <strong>{{ store.scopeTitle() || 'RSS' }}</strong>
        <button class="icon-btn" type="button" aria-label="Actualiser" (click)="store.refreshAll()">⟳</button>
      </header>

      @if (menu()) { <div class="scrim" (click)="menu.set(false)"></div> }

      <aside class="sidebar" [class.open]="menu()">
        <div class="side-head">
          <div class="seg" role="group">
            <button type="button" [class.on]="store.unreadOnly()" (click)="store.unreadOnly.set(true)">Non lus</button>
            <button type="button" [class.on]="!store.unreadOnly()" (click)="store.unreadOnly.set(false)">Tous</button>
          </div>
          <button class="icon-btn" type="button" aria-label="Actualiser" [class.spin]="store.syncing()" (click)="store.refreshAll()">⟳</button>
          <a class="icon-btn" routerLink="/feeds" aria-label="Ajouter un flux" (click)="menu.set(false)">＋</a>
        </div>

        <nav>
          <h3>Filtres</h3>
          <button type="button" class="item" [class.active]="is('all')" (click)="go({ type: 'all' })">
            <span>◉ Tous les flux</span><em>{{ store.unreadTotal() }}</em>
          </button>
          <button type="button" class="item" [class.active]="is('today')" (click)="go({ type: 'today' })">
            <span>▦ Aujourd'hui</span><em>{{ store.unreadToday() }}</em>
          </button>
          <button type="button" class="item" [class.active]="is('favorites')" (click)="go({ type: 'favorites' })">
            <span>☆ Favoris</span><em>{{ store.favoriteCount() }}</em>
          </button>
          <hr>
          @for (g of store.groups(); track g.id) {
            @if (g.id) {
              <button type="button" class="group" [class.active]="isCategory(g.id)" (click)="go({ type: 'category', id: g.id })">
                <span>{{ g.name }}</span><em>{{ g.unread }}</em>
              </button>
            } @else {
              <div class="group static"><span>{{ g.name }}</span><em>{{ g.unread }}</em></div>
            }
            @for (f of g.feeds; track f.id) {
              <button type="button" class="item feed" [class.active]="isFeed(f.id)" (click)="go({ type: 'feed', id: f.id })">
                <span class="avatar">{{ f.title.charAt(0).toUpperCase() }}</span>
                <span class="name">{{ f.title }}</span><em>{{ store.unreadByFeed().get(f.id) ?? 0 }}</em>
              </button>
            }
          }
        </nav>

        <div class="side-foot">
          <a class="icon-btn" routerLink="/feeds" aria-label="Gérer les flux" (click)="menu.set(false)">⚙</a>
          <div class="sync">
            <small>{{ store.syncing() ? 'Synchronisation…' : store.online() ? 'À jour' : 'Hors ligne' }}</small>
            <div class="bar"><i [class.run]="store.syncing()"></i></div>
          </div>
        </div>
      </aside>

      <main class="content">
        @if (!store.online()) { <div class="banner">Hors ligne : les articles enregistrés restent lisibles.</div> }
        @if (updates.available() && !updates.dismissed()) {
          <div class="banner">Nouvelle version prête.
            <button type="button" (click)="updates.apply()">Recharger</button>
            <button type="button" (click)="updates.dismiss()">Plus tard</button>
          </div>
        }
        @if (install.banner()) {
          <div class="banner">Installer l'application ?
            <button type="button" (click)="install.install()">Installer</button>
            <button type="button" (click)="install.dismiss()">Non merci</button>
          </div>
        }
        <router-outlet />
      </main>
    </div>
  `,
})
export class RootComponent {
  protected readonly store = inject(RssStore);
  protected readonly install = inject(InstallService);
  protected readonly updates = inject(UpdateService);
  private readonly router = inject(Router);
  protected readonly menu = signal(false);

  constructor() {
    void this.store.load();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.menu.set(false));
  }

  protected go(scope: Scope): void {
    this.store.scope.set(scope);
    this.menu.set(false);
    void this.router.navigateByUrl('/');
  }

  protected is(type: Scope['type']): boolean {
    return this.store.scope().type === type;
  }

  protected isFeed(id: string): boolean {
    const s = this.store.scope();
    return s.type === 'feed' && s.id === id;
  }

  protected isCategory(id: string): boolean {
    const s = this.store.scope();
    return s.type === 'category' && s.id === id;
  }
}
