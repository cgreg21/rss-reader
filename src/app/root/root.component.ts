import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AppPromptComponent } from '../pwa/app-prompt/app-prompt.component';
import { PushService } from '../pwa/services/push.service';
import { SyncService } from '../pwa/services/sync.service';
import { RssStore } from '../rss/rss.store';
import { DrawerContentComponent } from '../ui/drawer-content/drawer-content.component';
import { DrawerService } from '../ui/services/drawer.service';
import { LayoutService } from '../ui/services/layout.service';
import { TopBarComponent } from '../ui/top-bar/top-bar.component';
import { PullRefreshDirective } from '../ui/directives/pull-refresh.directive';
import { SnackbarComponent } from '../ui/snackbar/snackbar.component';
import { DialogComponent } from '../ui/dialog/dialog.component';
import { ArticleActionsComponent } from '../ui/article-actions/article-actions.component';
import { ArticleDetailActionsComponent } from '../ui/article-detail-actions/article-detail-actions.component';
import { UI_ICONS } from '../ui/icons';

const DRAWER_WIDTH = 280;
const SWIPE_SLOP = 10;
/** Width of the screen-edge bands where the browser starts its back/forward swipe. */
const EDGE_WIDTH = 24;

@Component({
  selector: 'rss-root',
  imports: [RouterOutlet, TopBarComponent, DrawerContentComponent, AppPromptComponent, SnackbarComponent, DialogComponent, ArticleActionsComponent, ArticleDetailActionsComponent, PullRefreshDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './root.component.html',
})
export class RootComponent {
  protected readonly store = inject(RssStore);
  protected readonly drawer = inject(DrawerService);
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);
  private readonly pushSync = inject(PushService);
  private readonly librarySync = inject(SyncService);
  protected readonly onArticles = signal(this.isArticles());
  protected readonly articleId = signal(this.currentArticleId());
  protected readonly onOptions = signal(this.isOptions());
  protected readonly ui = UI_ICONS;
  protected readonly refresh = (): Promise<void> => this.store.refreshAll();

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

  /** Native tooltip from the aria-label of icon-only buttons (desktop hover). */
  protected tooltip(event: MouseEvent): void {
    const el = (event.target as Element).closest<HTMLElement>('.icon-btn[aria-label], button[aria-label]:not([role="switch"])');
    const label = el?.getAttribute('aria-label');
    if (el && label && el.title !== label && !el.textContent?.trim().match(/^[A-Za-z0-9À-ÿ]/)) el.title = label;
  }

  private currentArticleId(): string | null {
    const match = /^\/article\/([^/?#]+)/.exec(this.router.url);
    return match ? decodeURIComponent(match[1]) : null;
  }

  private isArticles(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/';
  }

  private isOptions(): string {
    const path = this.router.url.split(/[?#]/)[0];
    return path === '/feeds' ? 'Options' : path === '/about' ? 'À propos' : '';
  }

  constructor() {
    void this.store.load();
    effect(() => {
      const count = this.store.unreadTotal();
      const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
      if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
      else void nav.clearAppBadge?.().catch(() => undefined);
    });
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      this.drawer.close();
      this.onArticles.set(this.isArticles());
      const id = this.currentArticleId();
      if (id && id !== this.articleId()) this.shell().nativeElement.querySelector('main')?.scrollTo(0, 0);
      this.articleId.set(id);
      this.onOptions.set(this.isOptions());
    });

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
