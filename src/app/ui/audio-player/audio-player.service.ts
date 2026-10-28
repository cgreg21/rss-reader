import { Injectable, signal } from '@angular/core';

import { MediaMeta, bindMediaSession } from '../directives/media-session.directive';

export interface AudioTrack {
  /** Article the audio belongs to. */
  id: string;
  src: string;
  meta: MediaMeta;
}

const RATES = [1, 1.25, 1.5, 2, 0.75];

/** Single app-wide audio element, so playback continues when the user navigates away from the article. */
@Injectable({ providedIn: 'root' })
export class AudioPlayerService {
  private readonly audio = new Audio();
  readonly track = signal<AudioTrack | null>(null);
  readonly playing = signal(false);
  readonly current = signal(0);
  readonly duration = signal(0);
  readonly rate = signal(1);

  constructor() {
    this.audio.preload = 'none';
    this.audio.addEventListener('play', () => this.playing.set(true));
    this.audio.addEventListener('pause', () => this.playing.set(false));
    this.audio.addEventListener('ended', () => this.playing.set(false));
    this.audio.addEventListener('timeupdate', () => this.current.set(this.audio.currentTime));
    this.audio.addEventListener('loadedmetadata', () => this.duration.set(this.audio.duration));
    this.audio.addEventListener('durationchange', () => this.duration.set(this.audio.duration));
  }

  /** Starts (or toggles) the given track; another playing track is replaced. */
  toggle(track: AudioTrack): void {
    if (this.track()?.id !== track.id) {
      this.audio.pause();
      this.audio.src = track.src;
      this.audio.playbackRate = this.rate();
      this.current.set(0);
      this.duration.set(0);
      this.track.set(track);
    }
    this.toggleCurrent();
  }

  toggleCurrent(): void {
    const track = this.track();
    if (!track) return;
    if (this.audio.paused) {
      bindMediaSession(this.audio, track.meta);
      void this.audio.play().catch(() => this.playing.set(false));
    } else {
      this.audio.pause();
    }
  }

  seek(seconds: number): void {
    this.audio.currentTime = seconds;
  }

  skip(seconds: number): void {
    this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || Infinity, this.audio.currentTime + seconds));
  }

  cycleRate(): void {
    const next = RATES[(RATES.indexOf(this.rate()) + 1) % RATES.length];
    this.rate.set(next);
    this.audio.playbackRate = next;
  }

  stop(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.track.set(null);
    this.current.set(0);
    this.duration.set(0);
  }
}
