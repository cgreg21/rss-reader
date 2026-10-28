import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { SettingsStore, proxyOrigin } from './settings.store';

describe('proxyOrigin', () => {
  it('keeps only the origin of http(s) urls', () => {
    expect(proxyOrigin(' https://p.example.com/path?x=1 ')).toBe('https://p.example.com');
    expect(proxyOrigin('http://localhost:8080/a')).toBe('http://localhost:8080');
  });

  it('rejects other protocols and garbage', () => {
    expect(proxyOrigin('ftp://x.com')).toBe('');
    expect(proxyOrigin('not a url')).toBe('');
  });
});

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('computes the active proxy', () => {
    const s = TestBed.inject(SettingsStore);
    expect(s.activeProxy()).toBe('');
    s.setProxy('  https://p.com/x ');
    expect(s.proxy()).toBe('https://p.com/x');
    expect(s.activeProxy()).toBe('https://p.com');
    s.proxyEnabled.set(false);
    expect(s.activeProxy()).toBe('');
  });

  it('normalises muted words', () => {
    const s = TestBed.inject(SettingsStore);
    s.setMutedWords([' Foo ', '', 'BAR']);
    expect(s.mutedWords()).toEqual(['foo', 'bar']);
  });

  it('applies theme and font size to the document', () => {
    const s = TestBed.inject(SettingsStore);
    s.theme.set('light');
    s.fontSize.set(0);
    TestBed.tick();
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--body-size')).toBe('17px');
    s.fontSize.set(20);
    TestBed.tick();
    expect(document.documentElement.style.getPropertyValue('--body-size')).toBe('20px');
  });
});
