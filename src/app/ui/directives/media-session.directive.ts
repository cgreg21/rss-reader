import { Directive, ElementRef, inject, input } from '@angular/core';

/** Exposes the playing audio / video to the OS (lock screen, notifications) so playback survives a screen-off. */
@Directive({
  selector: 'audio[rssMediaSession], video[rssMediaSession]',
  host: { '(play)': 'register()' },
})
export class MediaSessionDirective {
  readonly rssMediaSession = input.required<{ title: string; artist: string; artwork?: string }>();
  private readonly media = inject<ElementRef<HTMLMediaElement>>(ElementRef).nativeElement;

  protected register(): void {
    if (!('mediaSession' in navigator)) return;
    const { title, artist, artwork } = this.rssMediaSession();
    const session = navigator.mediaSession;
    session.metadata = new MediaMetadata({ title, artist, artwork: artwork ? [{ src: artwork }] : [] });
    const media = this.media;
    session.setActionHandler('play', () => void media.play());
    session.setActionHandler('pause', () => media.pause());
    session.setActionHandler('seekbackward', (d) => (media.currentTime = Math.max(0, media.currentTime - (d.seekOffset ?? 10))));
    session.setActionHandler('seekforward', (d) => (media.currentTime = Math.min(media.duration || Infinity, media.currentTime + (d.seekOffset ?? 10))));
  }
}
