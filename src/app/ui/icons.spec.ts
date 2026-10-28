import { describe, expect, it } from 'vitest';

import { UI_ICONS, glyph } from './icons';

describe('icons', () => {
  it('maps names to single glyphs', () => {
    expect(glyph('menu')).toBe(String.fromCodePoint(0xf035c));
    for (const value of Object.values(UI_ICONS)) expect(Array.from(value)).toHaveLength(1);
  });
});
