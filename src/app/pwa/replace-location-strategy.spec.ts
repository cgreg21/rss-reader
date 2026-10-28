import { TestBed } from '@angular/core/testing';
import { Location, LocationStrategy, PlatformLocation } from '@angular/common';
import { describe, expect, it, vi } from 'vitest';

import { ReplaceLocationStrategy } from './replace-location-strategy';

describe('ReplaceLocationStrategy', () => {
  it('replaces history entries instead of pushing', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LocationStrategy, useClass: ReplaceLocationStrategy }, Location] });
    const strategy = TestBed.inject(LocationStrategy);
    const platform = TestBed.inject(PlatformLocation);
    const push = vi.spyOn(platform, 'pushState');
    const replace = vi.spyOn(platform, 'replaceState');
    strategy.pushState(null, '', '/feeds', '');
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalled();
  });
});
