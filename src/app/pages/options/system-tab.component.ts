import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ImageCache } from '../../rss/image-cache.service';
import { SettingsStore } from '../../rss/settings.store';
import { PushService } from '../../pwa/push.service';
import { DialogService } from '../../ui/dialog.service';

/** Options tab: auto refresh, push notifications, CORS proxy and image cache. */
@Component({
  selector: 'rss-system-tab',
  host: { class: 'block' },
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-base font-bold">Actualisation automatique</h2>
        <select class="field" name="autoRefresh" aria-label="Intervalle d'actualisation automatique"
          [ngModel]="settings.autoRefresh()" (ngModelChange)="settings.autoRefresh.set(+$event)">
          <option [ngValue]="0">Désactivée</option>
          @for (m of autoRefreshOptions; track m) { <option [ngValue]="m">Toutes les {{ m }} min</option> }
        </select>
      </div>
      <p class="mt-2 text-[13px] text-muted">Les flux sont actualisés à cet intervalle lorsque l'application est ouverte et en ligne.</p>
    </section>

    <section class="panel">
      <div class="mb-2.5 flex items-center justify-between gap-3">
        <h2 class="text-base font-bold">Notifications</h2>
        <button type="button" role="switch" aria-label="Activer les notifications" [attr.aria-checked]="push.enabled()"
          class="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50" [class]="push.enabled() ? 'bg-accent' : 'bg-line'"
          [disabled]="!push.supported || push.busy()" (click)="push.enabled() ? push.disable() : push.enable()">
          <span class="absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform" [class.translate-x-5]="push.enabled()"></span>
        </button>
      </div>
      @if (push.supported) {
        <p class="mb-2 text-[13px] text-muted">Reçoit une notification pour les nouveaux articles, application fermée. Nécessite le serveur rss-reader-server ; sur iPhone, l'application doit être installée sur l'écran d'accueil.</p>
        <input class="field w-full" name="pushUrl" placeholder="https://rss-reader-server.onrender.com" [ngModel]="push.url()" (ngModelChange)="push.setUrl($event)">
        @if (push.error()) { <p class="mt-2 text-sm text-red-400">{{ push.error() }}</p> }
      } @else {
        <p class="text-[13px] text-muted">Notifications push non disponibles sur cet appareil ou dans ce mode (application installée requise).</p>
      }
    </section>

    <section class="panel">
      <div class="mb-2.5 flex items-center justify-between gap-3">
        <h2 class="text-base font-bold">Proxy CORS</h2>
        <button type="button" role="switch" aria-label="Activer le proxy CORS" [attr.aria-checked]="settings.proxyEnabled()"
          class="relative h-6 w-11 shrink-0 rounded-full transition-colors" [class]="settings.proxyEnabled() ? 'bg-accent' : 'bg-line'"
          (click)="settings.proxyEnabled.set(!settings.proxyEnabled())">
          <span class="absolute left-0.5 top-0.5 size-5 rounded-full bg-white transition-transform" [class.translate-x-5]="settings.proxyEnabled()"></span>
        </button>
      </div>
      <p class="mb-2 text-[13px] text-muted">La plupart des flux n'autorisent pas la lecture directe depuis un navigateur. Saisissez l'adresse de votre serveur rss-reader-server (par ex. https://rss-reader-server.onrender.com) ; désactivé ou vide, l'accès est direct.</p>
      <input class="field w-full disabled:opacity-50" name="proxy" placeholder="https://rss-reader-server.onrender.com" [disabled]="!settings.proxyEnabled()" [ngModel]="settings.proxy()" (ngModelChange)="settings.setProxy($event)">
    </section>

    <section class="panel">
      <h2 class="mb-2.5 text-base font-bold">Cache des images</h2>
      <p class="mb-2 text-[13px] text-muted">Les images chargées via le proxy sont conservées sur l'appareil ({{ images.count() }} en cache).</p>
      <button type="button" class="btn" [disabled]="images.count() === 0" (click)="clearImageCache()">Vider le cache</button>
    </section>
  `,
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
