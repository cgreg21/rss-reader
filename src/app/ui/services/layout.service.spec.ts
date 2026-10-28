import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LayoutService, SIDEBAR_QUERY, WIDE_QUERY } from './layout.service';

describe('LayoutService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the media queries', () => {
    const listeners = new Map<string, (e: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === WIDE_QUERY,
      addEventListener: (_: string, fn: (e: { matches: boolean }) => void) => listeners.set(query, fn),
    }));
    const layout = TestBed.inject(LayoutService);
    expect(layout.wide()).toBe(true);
    expect(layout.sidebar()).toBe(false);
    listeners.get(SIDEBAR_QUERY)!({ matches: true });
    listeners.get(WIDE_QUERY)!({ matches: false });
    expect(layout.sidebar()).toBe(true);
    expect(layout.wide()).toBe(false);
  });
});
