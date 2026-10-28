import { Directive, ElementRef, computed, inject, signal } from '@angular/core';

import { I18nService } from '../../i18n/services/i18n.service';
import { AxisGesture, isPrimaryPress } from '../gestures/pointer-gestures';
import { LayoutService } from '../services/layout.service';
import { DrawerService } from './drawer.service';

export const DRAWER_WIDTH = 280;
/** Width of the screen-edge bands where the browser starts its back/forward swipe. */
const EDGE_WIDTH = 24;
/** Attribute marking the element from which a closed drawer can be dragged open. */
export const DRAWER_EDGE_ATTR = 'data-drawer-edge';

/** Pointer-driven open/close of the navigation drawer on the app shell: drag from the edge to open, drag the open
 *  drawer back to close. Exposes the drawer position for the shell, the backdrop and the drawer itself. */
@Directive({
  selector: '[rssDrawerDrag]',
  exportAs: 'drawerDrag',
  host: {
    '(pointerdown)': 'onDown($event)',
    '(pointermove)': 'onMove($event)',
    '(pointerup)': 'onUp($event)',
    '(pointercancel)': 'onUp($event)',
  },
})
export class DrawerDragDirective {
  private readonly drawer = inject(DrawerService);
  private readonly layout = inject(LayoutService);
  private readonly i18n = inject(I18nService);
  private readonly shell = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  /** Horizontal offset of the drawer while a swipe is in progress, in [-DRAWER_WIDTH, 0]. */
  private readonly dragX = signal<number | null>(null);
  private readonly gesture = new AxisGesture();
  private origin = 0;
  private swiped = false;

  readonly dragging = computed(() => this.dragX() !== null);
  /** Drawer translation in px: 0 when open or in the permanent sidebar layout, -DRAWER_WIDTH when closed. */
  readonly drawerX = computed(() => this.layout.sidebar() ? 0 : this.dragX() ?? (this.drawer.opened() ? 0 : -DRAWER_WIDTH));
  /** 0 when the drawer is closed, 1 when fully open (always 0 in the sidebar layout). */
  readonly progress = computed(() => this.layout.sidebar() ? 0 : 1 + this.drawerX() / DRAWER_WIDTH);

  constructor() {
    // Non-passive so the browser's back/forward swipe is cancelled: while the drawer is dragged, and
    // for horizontal moves of a touch that started on a screen edge (where that gesture begins).
    let edgeTouch: { x: number; y: number } | null = null;
    document.addEventListener('touchstart', (event) => {
      const touch = event.touches?.[0];
      const onEdge = touch !== undefined && (touch.clientX < EDGE_WIDTH || touch.clientX > window.innerWidth - EDGE_WIDTH);
      edgeTouch = onEdge ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    document.addEventListener('touchmove', (event) => {
      if (this.gesture.axis === 'horizontal') {
        event.preventDefault();
        return;
      }
      const touch = event.touches?.[0];
      if (!edgeTouch || !touch) return;
      if (Math.abs(touch.clientX - edgeTouch.x) >= Math.abs(touch.clientY - edgeTouch.y)) event.preventDefault();
      else edgeTouch = null;
    }, { passive: false });
  }

  /** Closes the drawer on a backdrop tap, but not when the tap ends a drag. */
  onBackdropClick(): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    this.drawer.close();
  }

  protected onDown(event: PointerEvent): void {
    if (!isPrimaryPress(event) || this.layout.sidebar()) return;
    if (!this.drawer.opened() && !(event.target as Element).hasAttribute?.(DRAWER_EDGE_ATTR)) return;
    this.gesture.start(event);
    this.origin = this.drawerX();
    this.swiped = false;
  }

  protected onMove(event: PointerEvent): void {
    const move = this.gesture.move(event);
    if (move?.axis !== 'horizontal') return;
    if (move.started) this.shell.setPointerCapture(event.pointerId);
    this.swiped = true;
    this.dragX.set(Math.min(0, Math.max(-DRAWER_WIDTH, this.origin + move.dx * this.i18n.sign())));
  }

  protected onUp(event: PointerEvent): void {
    if (this.gesture.end(event)?.axis !== 'horizontal') return;
    const open = this.drawerX() > -DRAWER_WIDTH / 2;
    this.shell.releasePointerCapture?.(event.pointerId);
    this.dragX.set(null);
    if (open) this.drawer.show(); else this.drawer.close();
  }
}
