import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { InstallService } from './pwa/install.service';
import { UpdateService } from './pwa/update.service';
import { RssStore, Scope } from './rss/rss.store';
import { DrawerService } from './ui/drawer.service';
import { LayoutService } from './ui/layout.service';

const DRAWER_WIDTH = 280;
const SWIPE_SLOP = 10;
/** Width of the screen-edge bands where the browser starts its back/forward swipe. */
const EDGE_WIDTH = 24;

@Component({
  selector: 'rss-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #shell class="fixed inset-0 flex h-screen touch-pan-y flex-col overflow-hidden bg-bg pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] sidebar:flex-row"
         (pointerdown)="onDown($event)" (pointermove)="onMove($event)" (pointerup)="onUp($event)" (pointercancel)="onUp($event)">
      <div class="flex min-w-0 flex-1 flex-col sidebar:order-last">
        <header class="flex items-center justify-between gap-2 bg-side px-2.5 pb-1.5 pt-[max(6px,env(safe-area-inset-top))] sidebar:hidden">
          <button class="icon-btn" type="button" aria-label="Menu" (click)="drawer.show()">☰</button>
          <strong class="truncate">{{ store.scopeTitle() || 'RSS' }}</strong>
          <button class="icon-btn" type="button" aria-label="Actualiser" (click)="store.refreshAll()">⟳</button>
        </header>

        <main class="flex-1 overflow-y-auto p-3.5 sm:p-5 sidebar:px-8 sidebar:py-6">
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

      @if (!drawerActive()) {
        <div #edge class="absolute inset-y-0 left-0 z-20 w-6 touch-none" aria-hidden="true"></div>
      }

      <div class="absolute inset-0 z-30 bg-black/55 sidebar:hidden"
           [class]="dragging() ? '' : 'transition-opacity duration-200'"
           [class.pointer-events-none]="!drawer.opened() && !dragging()"
           [style.opacity]="backdropOpacity()"
           (click)="onBackdropClick()"></div>

      <aside class="absolute inset-y-0 left-0 z-30 flex w-[280px] shrink-0 touch-pan-y flex-col overflow-hidden bg-side p-3 pt-[max(12px,env(safe-area-inset-top))] shadow-2xl ease-out sidebar:static sidebar:order-first sidebar:pt-4 sidebar:shadow-none"
             [class]="dragging() ? '' : 'transition-transform duration-200'"
             [style.transform]="layout.sidebar() ? null : 'translateX(' + drawerX() + 'px)'"
             [attr.inert]="drawerActive() ? null : ''">
        <div class="flex items-center gap-2">
          <div class="flex flex-1 rounded-full bg-bg p-0.5" role="group">
            <button type="button" class="flex-1 rounded-full px-2.5 py-1 text-[13px]"
              [class]="store.unreadOnly() ? 'bg-accent text-white' : 'text-muted'" (click)="store.unreadOnly.set(true)">Non lus</button>
            <button type="button" class="flex-1 rounded-full px-2.5 py-1 text-[13px]"
              [class]="!store.unreadOnly() ? 'bg-accent text-white' : 'text-muted'" (click)="store.unreadOnly.set(false)">Tous</button>
          </div>
          <button class="icon-btn" type="button" aria-label="Actualiser" [class.animate-spin]="store.syncing()" (click)="store.refreshAll()">⟳</button>
          <a class="icon-btn" routerLink="/feeds" aria-label="Ajouter un flux" (click)="drawer.close()">＋</a>
        </div>

        <nav class="mt-3 flex-1 overflow-y-auto">
          <h3 class="p-2 text-sm font-normal text-muted">Filtres</h3>
          <button type="button" class="nav-item" [class.active]="is('all')" (click)="go({ type: 'all' })">
            <span>◉ Tous les flux</span><em class="nav-count">{{ store.unreadTotal() }}</em>
          </button>
          <button type="button" class="nav-item" [class.active]="is('today')" (click)="go({ type: 'today' })">
            <span>▦ Aujourd'hui</span><em class="nav-count">{{ store.unreadToday() }}</em>
          </button>
          <button type="button" class="nav-item" [class.active]="is('favorites')" (click)="go({ type: 'favorites' })">
            <span>☆ Favoris</span><em class="nav-count">{{ store.favoriteCount() }}</em>
          </button>
          <hr class="mx-1 my-2.5 border-line">
          @for (g of store.groups(); track g.id) {
            @if (g.id) {
              <button type="button" class="nav-item text-sm text-muted" [class.active]="isCategory(g.id)" (click)="go({ type: 'category', id: g.id })">
                <span>{{ g.name }}</span><em class="nav-count">{{ g.unread }}</em>
              </button>
            } @else {
              <div class="flex justify-between p-2 text-sm text-muted"><span>{{ g.name }}</span><em class="nav-count">{{ g.unread }}</em></div>
            }
            @for (f of g.feeds; track f.id) {
              <button type="button" class="nav-item" [class.active]="isFeed(f.id)" (click)="go({ type: 'feed', id: f.id })">
                <span class="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-xs font-semibold text-white">{{ f.title.charAt(0).toUpperCase() }}</span>
                <span class="flex-1 truncate">{{ f.title }}</span><em class="nav-count">{{ store.unreadByFeed().get(f.id) ?? 0 }}</em>
              </button>
            }
          }
        </nav>

        <div class="flex items-center gap-3 pt-2">
          <a class="icon-btn" routerLink="/feeds" aria-label="Gérer les flux" (click)="drawer.close()">⚙</a>
          <div class="flex-1">
            <small class="text-accent">{{ store.syncing() ? 'Synchronisation…' : store.online() ? 'À jour' : 'Hors ligne' }}</small>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <i class="block h-full bg-accent" [class]="store.syncing() ? 'w-2/5 animate-pulse' : 'w-full'"></i>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
})
export class RootComponent {
  protected readonly store = inject(RssStore);
  protected readonly install = inject(InstallService);
  protected readonly updates = inject(UpdateService);
  protected readonly drawer = inject(DrawerService);
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  private readonly shell = viewChild.required<ElementRef<HTMLElement>>('shell');
  private readonly edge = viewChild<ElementRef<HTMLElement>>('edge');
  /** Horizontal offset of the drawer while a swipe is in progress, in [-DRAWER_WIDTH, 0]. */
  private readonly dragX = signal<number | null>(null);
  private drag: { x: number; y: number; origin: number; id: number; direction: 'horizontal' | 'vertical' | null } | null = null;
  private swiped = false;

  protected readonly dragging = computed(() => this.dragX() !== null);
  protected readonly drawerX = computed(() => this.layout.sidebar() ? 0 : this.dragX() ?? (this.drawer.opened() ? 0 : -DRAWER_WIDTH));
  protected readonly backdropOpacity = computed(() => this.layout.sidebar() ? 0 : 1 + this.drawerX() / DRAWER_WIDTH);
  protected readonly drawerActive = computed(() => this.layout.sidebar() || this.drawer.opened());

  constructor() {
    void this.store.load();
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.drawer.close());

    // Non-passive so the browser's back/forward swipe is cancelled: while the drawer is dragged, and
    // for horizontal moves of a touch that started on a screen edge (where that gesture begins).
    let edgeTouch: { x: number; y: number } | null = null;
    document.addEventListener('touchstart', (event) => {
      const touch = event.touches?.[0];
      const onEdge = touch !== undefined && (touch.clientX < EDGE_WIDTH || touch.clientX > window.innerWidth - EDGE_WIDTH);
      edgeTouch = onEdge ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    document.addEventListener('touchmove', (event) => {
      if (this.drag?.direction === 'horizontal') {
        event.preventDefault();
        return;
      }
      const touch = event.touches?.[0];
      if (!edgeTouch || !touch) return;
      if (Math.abs(touch.clientX - edgeTouch.x) >= Math.abs(touch.clientY - edgeTouch.y)) event.preventDefault();
      else edgeTouch = null;
    }, { passive: false });
    // iOS leaves the page scrolled/shrunk once the keyboard of a field closes: bring the view back.
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) window.scrollTo(0, 0);
      }, 100);
    });
  }

  protected go(scope: Scope): void {
    this.store.scope.set(scope);
    this.drawer.close();
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

  protected onBackdropClick(): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.drawer.close();
  }

  protected onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (this.layout.sidebar()) return;
    if (!this.drawer.opened() && event.target !== this.edge()?.nativeElement) return;
    this.drag = { x: event.clientX, y: event.clientY, origin: this.drawerX(), id: event.pointerId, direction: null };
    this.swiped = false;
  }

  protected onMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (drag.direction === null && Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_SLOP) {
      drag.direction = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
      if (drag.direction === 'horizontal') {
        this.shell().nativeElement.setPointerCapture(event.pointerId);
      } else {
        this.drag = null;
        return;
      }
    }
    if (drag.direction === 'horizontal') {
      this.swiped = true;
      this.dragX.set(Math.min(0, Math.max(-DRAWER_WIDTH, drag.origin + dx)));
    }
  }

  protected onUp(event: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || event.pointerId !== drag.id || drag.direction !== 'horizontal') return;
    const open = this.drawerX() > -DRAWER_WIDTH / 2;
    this.shell().nativeElement.releasePointerCapture?.(event.pointerId);
    this.dragX.set(null);
    if (open) this.drawer.show(); else this.drawer.close();
  }
}
