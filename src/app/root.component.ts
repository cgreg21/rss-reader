import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { InstallService } from './pwa/install.service';
import { UpdateService } from './pwa/update.service';
import { RssStore, Scope } from './rss/rss.store';
import { DrawerService } from './ui/drawer.service';
import { LayoutService } from './ui/layout.service';
import { UI_ICONS } from './ui/icons';
import { APP_VERSION } from './pwa/app-info';

const DRAWER_WIDTH = 280;
const SWIPE_SLOP = 10;
/** Width of the screen-edge bands where the browser starts its back/forward swipe. */
const EDGE_WIDTH = 24;

@Component({
  selector: 'rss-root',
  imports: [RouterOutlet, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './root.component.html',
})
export class RootComponent {
  protected readonly store = inject(RssStore);
  protected readonly install = inject(InstallService);
  protected readonly updates = inject(UpdateService);
  protected readonly drawer = inject(DrawerService);
  protected readonly layout = inject(LayoutService);
  protected readonly ui = UI_ICONS;
  protected readonly version = APP_VERSION;
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
