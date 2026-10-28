import { describe, expect, it } from 'vitest';

import { APP_VERSION } from './app-info';

describe('APP_VERSION', () => {
  it('is a semver string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
