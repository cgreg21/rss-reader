import { describe, expect, it } from 'vitest';

import { newId } from './ids';

describe('newId', () => {
  it('prefixes distinct ids', () => {
    expect(newId('f')).toMatch(/^f[a-z0-9]+$/);
    expect(newId('c')).toMatch(/^c/);
    expect(newId('f')).not.toBe(newId('f'));
  });
});
