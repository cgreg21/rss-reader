import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { OfflineMediaService } from '../../rss/services/offline-media.service';
import { UI_ICONS } from '../icons';

/** Bottom-left download progress bar; a click opens the list of queued downloads. */
@Component({
  selector: 'rss-download-queue',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed start-3 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 sidebar:start-[296px]' },
  template: `
    @if (media.queue().length) {
      <button type="button" class="pointer-events-auto relative grid size-12 place-items-center rounded-full bg-side shadow-lg active:scale-95"
        [attr.aria-label]="('downloads.title' | translate) + ' · ' + ('downloads.count' | translate: { n: media.pending() })" (click)="open.set(true)">
        <svg class="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true" [class.animate-spin]="barWidth() < 0">
          <circle cx="24" cy="24" r="21" fill="none" stroke-width="3" class="stroke-line" />
          <circle cx="24" cy="24" r="21" fill="none" stroke-width="3" stroke-linecap="round" class="stroke-accent transition-[stroke-dashoffset] duration-200"
            [attr.stroke-dasharray]="circumference" [attr.stroke-dashoffset]="circumference * (1 - (barWidth() < 0 ? 0.25 : barWidth() / 100))" />
        </svg>
        <span class="relative text-sm font-semibold text-slate-100">{{ media.pending() }}</span>
      </button>
    }
    @if (open()) {
      <div class="pointer-events-auto fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" (click)="open.set(false)" animate.enter="anim-fade-in" animate.leave="anim-fade-out">
        <div class="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-line bg-side p-5 shadow-2xl" role="dialog" aria-modal="true"
          [attr.aria-label]="'downloads.title' | translate" animate.enter="anim-pop-in" (click)="$event.stopPropagation()">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-lg font-semibold">{{ 'downloads.title' | translate }}</h2>
            <button class="icon-btn" type="button" [attr.aria-label]="'common.close' | translate" (click)="open.set(false)">{{ ui.close }}</button>
          </div>
          <ul class="min-h-0 overflow-y-auto">
            @for (it of media.queue(); track it.id) {
              <li class="flex items-center gap-2 border-t border-line py-2">
                <div class="min-w-0 flex-1">
                  <strong class="block truncate text-sm">{{ it.title }}</strong>
                  <small [class]="it.status === 'error' ? 'text-red-400' : 'text-muted'">
                    {{ (it.status === 'error' ? 'media.failed' : it.status === 'waiting' ? 'media.waiting' : 'media.downloading') | translate }}
                    @if (it.status === 'downloading' && it.progress >= 0) { {{ (it.progress * 100).toFixed(0) }}% }
                  </small>
                  @if (it.status === 'downloading') {
                    <span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                      <i class="block h-full bg-accent transition-[width] duration-200" [class.animate-pulse]="it.progress < 0" [style.width.%]="it.progress < 0 ? 40 : it.progress * 100"></i>
                    </span>
                  }
                </div>
                @if (it.status === 'error') {
                  <button class="icon-btn" type="button" [attr.aria-label]="'media.retry' | translate" (click)="media.enqueue(it.id, it.url, it.title)">{{ ui.refresh }}</button>
                }
                <button class="icon-btn" type="button" [attr.aria-label]="'downloads.remove' | translate" (click)="media.dismiss(it.id)">{{ ui.close }}</button>
              </li>
            }
          </ul>
        </div>
      </div>
    }
  `,
})
export class DownloadQueueComponent {
  protected readonly media = inject(OfflineMediaService);
  protected readonly ui = UI_ICONS;
  protected readonly circumference = 2 * Math.PI * 21;
  protected readonly open = signal(false);
  protected readonly barWidth = computed(() => {
    const p = this.media.currentProgress();
    return p < 0 ? -1 : p * 100;
  });

  constructor() {
    effect(() => {
      if (!this.media.queue().length) this.open.set(false);
    });
  }
}
