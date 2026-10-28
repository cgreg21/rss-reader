import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ImageCache } from '../../../rss/services/image-cache.service';
import { SettingsStore } from '../../../rss/settings.store';
import { PushService } from '../../../pwa/services/push.service';
import { DialogService } from '../../../ui/services/dialog.service';

/** Options tab: auto refresh, push notifications, CORS proxy and image cache. */
@Component({
  selector: 'rss-system-tab',
  host: { class: 'block' },
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-tab.component.html',
})
export class SystemTabComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly push = inject(PushService);
  protected readonly images = inject(ImageCache);
  private readonly dialog = inject(DialogService);
  protected readonly autoRefreshOptions = [5, 15, 30, 60];

  constructor() {
    void this.images.refreshCount();
  }

  protected async clearImageCache(): Promise<void> {
    if (await this.dialog.confirm('Supprimer toutes les images en cache ?', { title: 'Vider le cache' })) await this.images.clear();
  }
}
