import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { glyph } from '../icons';
import { UI_ICONS } from '../icons';
import { AudioPlayerService } from './audio-player.service';
import { clock } from './audio-player.component';

/** Floating play button (bottom right) that keeps the audio reachable on other pages; opens a mini player. */
@Component({
  selector: 'rss-mini-player',
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed end-3 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 flex flex-col items-end gap-2' },
  template: `
    @if (visible(); as track) {
      @if (open()) {
        <div class="pointer-events-auto w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-side p-3 shadow-2xl" dir="ltr" animate.enter="anim-up-in" animate.leave="anim-up-out">
          <div class="flex items-start gap-2">
            <a class="min-w-0 flex-1" [routerLink]="['/article', track.id]" (click)="open.set(false)">
              <strong class="line-clamp-2 block text-sm">{{ track.meta.title }}</strong>
              <small class="block truncate text-muted">{{ track.meta.artist }}</small>
            </a>
            <button type="button" class="icon-btn !size-9 !min-w-9" [attr.aria-label]="'common.close' | translate" (click)="close()">{{ ui.close }}</button>
          </div>
          <input type="range" class="mt-2 h-2 w-full cursor-pointer accent-accent" min="0" step="1" aria-label="Seek"
            [max]="player.duration() || 0" [value]="player.current()" [disabled]="!player.duration()" (input)="player.seek(+$any($event.target).value)">
          <div class="flex items-center gap-1">
            <span class="w-12 text-xs tabular-nums text-muted">{{ clock(player.current()) }}</span>
            <div class="flex flex-1 items-center justify-center gap-1">
              <button type="button" class="icon-btn" aria-label="-15s" (click)="player.skip(-15)">{{ back }}</button>
              <button type="button" class="grid size-10 place-items-center rounded-full bg-accent font-mdi text-[24px] text-white active:scale-90"
                [attr.aria-label]="player.playing() ? 'Pause' : 'Play'" (click)="player.toggleCurrent()">{{ player.playing() ? pauseIcon : playIcon }}</button>
              <button type="button" class="icon-btn" aria-label="+30s" (click)="player.skip(30)">{{ forward }}</button>
            </div>
            <span class="w-12 text-end text-xs tabular-nums text-muted">{{ clock(player.duration()) }}</span>
          </div>
        </div>
      }
      <button type="button" class="pointer-events-auto grid size-14 place-items-center rounded-full bg-accent font-mdi text-[28px] text-white shadow-lg transition-transform active:scale-90"
        [class.animate-pulse]="player.playing() && !open()" [attr.aria-expanded]="open()" [attr.aria-label]="track.meta.title" (click)="open.set(!open())">{{ player.playing() ? pauseIcon : playIcon }}</button>
    }
  `,
})
export class MiniPlayerComponent {
  /** Article currently displayed: the mini player hides itself on the page of its own track. */
  readonly articleId = input<string | null>(null);
  protected readonly player = inject(AudioPlayerService);
  protected readonly open = signal(false);
  protected readonly ui = UI_ICONS;
  protected readonly visible = computed(() => {
    const track = this.player.track();
    return track && track.id !== this.articleId() ? track : null;
  });
  protected readonly playIcon = glyph('play');
  protected readonly pauseIcon = glyph('pause');
  protected readonly back = glyph('rewind-15');
  protected readonly forward = glyph('fast-forward-30');
  protected readonly clock = clock;

  protected close(): void {
    this.open.set(false);
    this.player.stop();
  }
}
