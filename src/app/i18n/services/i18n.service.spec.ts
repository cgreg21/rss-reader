import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SettingsStore } from '../../rss/stores/settings.store';
import { MessageError } from '../message-error';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  const setup = (browser?: string[]) => {
    localStorage.clear();
    TestBed.resetTestingModule();
    if (browser) vi.spyOn(navigator, 'languages', 'get').mockReturnValue(browser);
    return { i18n: TestBed.inject(I18nService), settings: TestBed.inject(SettingsStore) };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('follows the browser language by default', () => {
    expect(setup().i18n.lang()).toBe('fr');
    expect(setup(['de-AT', 'en']).i18n.lang()).toBe('de');
    expect(setup(['xx', 'es_MX']).i18n.lang()).toBe('es');
  });

  it('falls back to English for unsupported languages', () => {
    expect(setup(['ja-JP']).i18n.lang()).toBe('en');
  });

  it('uses navigator.language when the list is empty', () => {
    expect(setup([]).i18n.lang()).toBe('fr');
  });

  it('persists an explicit choice', () => {
    const { i18n, settings } = setup(['fr']);
    settings.language.set('en');
    expect(i18n.lang()).toBe('en');
    TestBed.tick();
    expect(localStorage.getItem('rssreader:language')).toContain('en');
    settings.language.set('auto');
    expect(i18n.lang()).toBe('fr');
  });

  it('translates with interpolation and fallbacks', () => {
    const { i18n, settings } = setup();
    settings.language.set('en');
    expect(i18n.t('common.cancel')).toBe('Cancel');
    expect(i18n.t('downloads.count', { n: 4 })).toContain('4');
    expect(i18n.t('downloads.count', { x: 1 })).toContain('{n}');
    expect(i18n.t('nope.key' as never)).toBe('nope.key');
  });

  it('falls back to English then to the key for missing entries', () => {
    const { i18n } = setup();
    expect(i18n.t('nope.key' as never)).toBe('nope.key');
  });

  it('formats error texts', () => {
    const { i18n } = setup();
    expect(i18n.errorText(new MessageError('err.invalidFeed'))).toBe(i18n.t('err.invalidFeed'));
    expect(i18n.errorText(new Error('boom'))).toBe('boom');
    expect(i18n.errorText('x')).toBe(i18n.t('err.generic'));
    expect(i18n.errorText(1, 'common.cancel')).toBe(i18n.t('common.cancel'));
  });

  it('formats dates in the language locale', () => {
    const { i18n, settings } = setup();
    const d = new Date(2025, 0, 31, 14, 5, 9);
    settings.language.set('fr');
    expect(i18n.date(d)).toContain('31/01/2025');
    settings.language.set('en');
    expect(i18n.date(d)).toContain('1/31/25');
    expect(i18n.date(d, 'time')).toContain('2:05:09');
    expect(i18n.date(null)).toBe('');
  });

  it('reflects language and direction on the document', () => {
    const { i18n, settings } = setup();
    TestBed.tick();
    expect(document.documentElement.lang).toBe('fr');
    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.sign()).toBe(1);
    settings.language.set('ar');
    TestBed.tick();
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(i18n.sign()).toBe(-1);
    expect(i18n.speechLang()).toBe('ar-SA');
  });
});
