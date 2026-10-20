import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { APP_VERSION } from '../pwa/app-info';
import { RssStore, Scope } from '../rss/rss.store';
import { DrawerService } from './drawer.service';
import { UI_ICONS } from './icons';

/** Drawer body: unread toggle, filters, categories with their feeds, sync status and version. */
@Component({
  selector: 'rss-drawer-content',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './drawer-content.component.html',
})
export class DrawerContentComponent {
  protected readonly store = inject(RssStore);
  protected readonly drawer = inject(DrawerService);
  protected readonly ui = UI_ICONS;
  protected readonly version = APP_VERSION;
  private readonly router = inject(Router);

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
}
