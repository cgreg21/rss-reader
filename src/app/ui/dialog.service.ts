import { Injectable, signal } from '@angular/core';

export interface DialogButton<T = unknown> {
  label: string;
  value: T;
  kind?: 'primary' | 'danger' | 'ghost';
}

export interface DialogConfig<T = unknown> {
  title?: string;
  message?: string;
  buttons: DialogButton<T>[];
  /** Shows a text field; its value is returned by `prompt()`. */
  input?: { value?: string; placeholder?: string; type?: string };
  /** Value resolved when dismissed via backdrop or Escape. */
  dismissValue: T;
  /** Button value confirmed with Enter in the text field. */
  submitValue?: T;
}

export interface OpenDialog extends DialogConfig {
  id: number;
  text: string;
}

/** Promise-based generic dialogs: alert, confirm, prompt or fully custom buttons. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly current = signal<OpenDialog | null>(null);
  private nextId = 0;
  private resolver: ((result: { value: unknown; text: string }) => void) | null = null;

  /** Opens a custom dialog and resolves with the clicked button's value. */
  open<T>(config: DialogConfig<T>): Promise<T> {
    this.close(config.dismissValue as unknown);
    return new Promise<T>((resolve) => {
      this.resolver = (r) => resolve(r.value as T);
      this.current.set({ ...config, id: ++this.nextId, text: config.input?.value ?? '' } as OpenDialog);
    });
  }

  alert(message: string, title?: string): Promise<void> {
    return this.open<void>({ title, message, buttons: [{ label: 'OK', value: undefined, kind: 'primary' }], dismissValue: undefined });
  }

  confirm(message: string, opts: { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
    return this.open<boolean>({
      title: opts.title,
      message,
      buttons: [
        { label: opts.cancelLabel ?? 'Annuler', value: false, kind: 'ghost' },
        { label: opts.confirmLabel ?? 'Confirmer', value: true, kind: opts.danger ? 'danger' : 'primary' },
      ],
      dismissValue: false,
      submitValue: true,
    });
  }

  /** Resolves with the entered text, or null if cancelled. */
  async prompt(message: string, opts: { title?: string; value?: string; placeholder?: string; type?: string; confirmLabel?: string } = {}): Promise<string | null> {
    const dialog = this.open<boolean>({
      title: opts.title,
      message,
      input: { value: opts.value, placeholder: opts.placeholder, type: opts.type },
      buttons: [
        { label: 'Annuler', value: false, kind: 'ghost' },
        { label: opts.confirmLabel ?? 'OK', value: true, kind: 'primary' },
      ],
      dismissValue: false,
      submitValue: true,
    });
    const ok = await dialog;
    return ok ? this.lastText : null;
  }

  private lastText = '';

  setText(text: string): void {
    const current = this.current();
    if (current) this.current.set({ ...current, text });
  }

  /** Closes the open dialog with the given value. */
  close(value: unknown): void {
    const current = this.current();
    if (!this.resolver) return;
    this.lastText = current?.text ?? '';
    const resolve = this.resolver;
    this.resolver = null;
    this.current.set(null);
    resolve({ value, text: this.lastText });
  }

  dismiss(): void {
    const current = this.current();
    if (current) this.close(current.dismissValue);
  }
}
