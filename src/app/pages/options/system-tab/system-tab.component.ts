import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { I18nService } from '../../../i18n/services/i18n.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { ImageCache } from '../../../rss/services/image-cache.service';
import { SettingsStore } from '../../../rss/settings.store';
import { PushService } from '../../../pwa/services/push.service';
import { DialogService } from '../../../ui/services/dialog.service';

/** Options tab: auto refresh, push notifications, CORS proxy and image cache. */
@Component({
  selector: 'rss-system-tab',
  host: { class: 'block' },
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './system-tab.component.html',
})
export class SystemTabComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly push = inject(PushService);
  protected readonly images = inject(ImageCache);
  private readonly dialog = inject(DialogService);
  private readonly i18n = inject(I18nService);
  protected readonly autoRefreshOptions = [5, 15, 30, 60];

  constructor() {
    void this.images.refreshCount();
  }

  protected async clearImageCache(): Promise<void> {
    if (await this.dialog.confirm(this.i18n.t('system.clearConfirm'), { title: this.i18n.t('system.clearCache') })) await this.images.clear();
  }
}
