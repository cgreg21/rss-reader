import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { APP_VERSION } from '../../pwa/app-info';
import { SyncService } from '../../pwa/services/sync.service';
import { ArticlesStore } from '../../rss/articles.store';
import { RefreshService } from '../../rss/services/refresh.service';
import { Scope, ViewStore } from '../../rss/view.store';
import { DrawerService } from '../services/drawer.service';
import { UI_ICONS } from '../icons';

/** Drawer body: unread toggle, filters, categories with their feeds, sync status and version. */
@Component({
  selector: 'rss-drawer-content',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './drawer-content.component.html',
})
export class DrawerContentComponent {
  protected readonly view = inject(ViewStore);
  protected readonly articles = inject(ArticlesStore);
  protected readonly refresher = inject(RefreshService);
  protected readonly drawer = inject(DrawerService);
  private readonly sync = inject(SyncService);

  /** Manual refresh: feeds, plus a sync retry (clears a failure stop). */
  protected refresh(): void {
    void this.refresher.refreshAll();
    this.sync.resume();
  }
  protected readonly ui = UI_ICONS;
  protected readonly version = APP_VERSION;
  private readonly router = inject(Router);

  protected go(scope: Scope): void {
    this.view.scope.set(scope);
    this.drawer.close();
    void this.router.navigateByUrl('/');
  }

  protected is(type: Scope['type']): boolean {
    return this.view.scope().type === type;
  }

  protected isFeed(id: string): boolean {
    const s = this.view.scope();
    return s.type === 'feed' && s.id === id;
  }

  protected isCategory(id: string): boolean {
    const s = this.view.scope();
    return s.type === 'category' && s.id === id;
  }
}
