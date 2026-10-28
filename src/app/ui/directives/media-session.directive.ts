import { Directive, ElementRef, inject, input } from '@angular/core';

export interface MediaMeta {
  title: string;
  artist: string;
  artwork?: string;
}

/** Exposes the playing media to the OS (lock screen, notifications) so playback survives a screen-off. */
export function bindMediaSession(media: HTMLMediaElement, meta: MediaMeta): void {
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;
  session.metadata = new MediaMetadata({ title: meta.title, artist: meta.artist, artwork: meta.artwork ? [{ src: meta.artwork }] : [] });
  session.setActionHandler('play', () => void media.play());
  session.setActionHandler('pause', () => media.pause());
  session.setActionHandler('seekbackward', (d) => (media.currentTime = Math.max(0, media.currentTime - (d.seekOffset ?? 10))));
  session.setActionHandler('seekforward', (d) => (media.currentTime = Math.min(media.duration || Infinity, media.currentTime + (d.seekOffset ?? 10))));
}

@Directive({
  selector: 'audio[rssMediaSession], video[rssMediaSession]',
  host: { '(play)': 'register()' },
})
export class MediaSessionDirective {
  readonly rssMediaSession = input.required<MediaMeta>();
  private readonly media = inject<ElementRef<HTMLMediaElement>>(ElementRef).nativeElement;

  protected register(): void {
    bindMediaSession(this.media, this.rssMediaSession());
  }
}
