import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { MediaMeta } from '../directives/media-session.directive';
import { glyph } from '../icons';
import { AudioPlayerService } from './audio-player.service';

export const clock = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** Audio player of an article, in the app's look; the audio itself lives in the shared AudioPlayerService. */
@Component({
  selector: 'rss-audio-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col gap-2 rounded-2xl bg-side p-3" dir="ltr">
      <input type="range" class="h-2 w-full cursor-pointer accent-accent" min="0" step="1" aria-label="Seek"
        [max]="duration() || 0" [value]="current()" [disabled]="!duration()" (input)="player.seek(+$any($event.target).value)">
      <div class="flex items-center gap-1">
        <span class="w-14 text-xs tabular-nums text-muted">{{ clock(current()) }}</span>
        <div class="flex flex-1 items-center justify-center gap-2">
          <button type="button" class="icon-btn" aria-label="-15s" [disabled]="!active()" (click)="player.skip(-15)">{{ back }}</button>
          <button type="button" class="grid size-12 place-items-center rounded-full bg-accent font-mdi text-[28px] text-white shadow-lg active:scale-90"
            [attr.aria-label]="playing() ? 'Pause' : 'Play'" (click)="toggle()">{{ playing() ? pauseIcon : playIcon }}</button>
          <button type="button" class="icon-btn" aria-label="+30s" [disabled]="!active()" (click)="player.skip(30)">{{ forward }}</button>
        </div>
        <span class="w-14 text-end text-xs tabular-nums text-muted">{{ clock(duration()) }}</span>
        <button type="button" class="rounded-full px-2 py-1 text-xs font-semibold text-muted hover:bg-white/5 hover:text-slate-100" aria-label="Speed" (click)="player.cycleRate()">{{ player.rate() }}×</button>
      </div>
    </div>
  `,
})
export class AudioPlayerComponent {
  readonly id = input.required<string>();
  readonly src = input.required<string>();
  readonly meta = input.required<MediaMeta>();
  protected readonly player = inject(AudioPlayerService);

  protected readonly active = computed(() => this.player.track()?.id === this.id());
  protected readonly playing = computed(() => this.active() && this.player.playing());
  protected readonly current = computed(() => (this.active() ? this.player.current() : 0));
  protected readonly duration = computed(() => (this.active() ? this.player.duration() : 0));
  protected readonly playIcon = glyph('play');
  protected readonly pauseIcon = glyph('pause');
  protected readonly back = glyph('rewind-15');
  protected readonly forward = glyph('fast-forward-30');
  protected readonly clock = clock;

  protected toggle(): void {
    this.player.toggle({ id: this.id(), src: this.src(), meta: this.meta() });
  }
}
