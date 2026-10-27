import { WritableSignal, signal } from '@angular/core';

/** How a value is stored in localStorage (kept compatible with the formats already saved on devices). */
export interface Codec<T> {
  read(raw: string | null): T;
  write(value: T): string;
}

export const text = (fallback = ''): Codec<string> => ({ read: (raw) => raw ?? fallback, write: (v) => v });
export const num = (fallback: number): Codec<number> => ({ read: (raw) => Number(raw ?? fallback) || 0, write: String });
export const flag = (fallback: boolean): Codec<boolean> => ({ read: (raw) => (raw === null ? fallback : raw !== '0'), write: (v) => (v ? '1' : '0') });
export const json = <T>(fallback: T): Codec<T> => ({ read: (raw) => (raw === null ? fallback : (JSON.parse(raw) as T)), write: (v) => JSON.stringify(v) });
export const oneOf = <T extends string>(values: readonly T[], fallback: T): Codec<T> => ({
  read: (raw) => (values.includes(raw as T) ? (raw as T) : fallback),
  write: (v) => v,
});

/** A signal mirrored to localStorage on every write. */
export function persisted<T>(key: string, codec: Codec<T>): WritableSignal<T> {
  const state = signal(codec.read(localStorage.getItem(key)));
  const set = state.set.bind(state);
  state.set = (value: T) => {
    set(value);
    localStorage.setItem(key, codec.write(value));
  };
  state.update = (fn: (value: T) => T) => state.set(fn(state()));
  return state;
}
