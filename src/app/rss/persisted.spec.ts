import { beforeEach, describe, expect, it } from 'vitest';

import { flag, json, num, oneOf, persisted, text } from './persisted';

describe('persisted', () => {
  beforeEach(() => localStorage.clear());

  it('reads fallbacks and stored values', () => {
    localStorage.setItem('n', '20');
    expect(persisted('n', num(17))()).toBe(20);
    expect(persisted('t', text('x'))()).toBe('x');
    expect(persisted('f', flag(true))()).toBe(true);
    expect(persisted('o', oneOf(['a', 'b'], 'a'))()).toBe('a');
  });

  it('writes through set and update', () => {
    const s = persisted('j', json<string[]>([]));
    s.set(['a']);
    s.update((v) => [...v, 'b']);
    expect(localStorage.getItem('j')).toBe('["a","b"]');
    const f = persisted('f', flag(true));
    f.set(false);
    expect(localStorage.getItem('f')).toBe('0');
    expect(persisted('f', flag(true))()).toBe(false);
  });

  it('rejects unknown enum values', () => {
    localStorage.setItem('o', 'zzz');
    expect(persisted('o', oneOf(['a', 'b'], 'b'))()).toBe('b');
  });
});
