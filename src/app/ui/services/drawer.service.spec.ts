import { describe, expect, it } from 'vitest';

import { DrawerService } from './drawer.service';

describe('DrawerService', () => {
  it('opens and closes', () => {
    const d = new DrawerService();
    d.show();
    expect(d.opened()).toBe(true);
    d.close();
    expect(d.opened()).toBe(false);
  });
});
