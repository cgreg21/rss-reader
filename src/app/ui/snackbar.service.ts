import { Injectable, signal } from '@angular/core';

export type SnackbarKind = 'success' | 'error' | 'info';

export interface SnackbarAction {
  label: string;
  run(): void;
  /** Main action: highlighted button. */
  primary?: boolean;
}

export interface SnackbarOptions {
  kind?: SnackbarKind;
  /** Bold first line. */
  title?: string;
  /** Image shown at the start of the card (url relative to the base href). */
  image?: string;
  actions?: SnackbarAction[];
  /** Milliseconds before it disappears; `0` keeps it until dismissed. */
  duration?: number;
}

export interface SnackbarMessage extends SnackbarOptions {
  id: number;
  text: string;
  kind: SnackbarKind;
}

const DEFAULT_DURATION = 3500;
const LONG_DURATION = 6000;

/** Feedback card shown at the bottom of the screen; a new message replaces the previous one. */
@Injectable({ providedIn: 'root' })
export class SnackbarService {
  readonly current = signal<SnackbarMessage | null>(null);
  private counter = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** Returns the id of the message, to dismiss it later with `dismiss(id)`. */
  show(text: string, options: SnackbarOptions = {}): number {
    const kind = options.kind ?? 'success';
    this.clearTimer();
    this.counter += 1;
    this.current.set({ ...options, id: this.counter, text, kind });
    const duration = options.duration ?? (kind === 'error' || options.actions?.length ? LONG_DURATION : DEFAULT_DURATION);
    if (duration > 0) this.timer = setTimeout(() => this.dismiss(), duration);
    return this.counter;
  }

  error(text: string): number {
    return this.show(text, { kind: 'error' });
  }

  /** Without an id, dismisses whatever is shown; with one, only that message. */
  dismiss(id?: number): void {
    if (id !== undefined && this.current()?.id !== id) return;
    this.clearTimer();
    this.current.set(null);
  }

  runAction(action: SnackbarAction): void {
    this.dismiss();
    action.run();
  }

  private clearTimer(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
