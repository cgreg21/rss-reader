import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { SettingsStore } from '../../../rss/stores/settings.store';
import { ReadingTabComponent } from './reading-tab.component';

describe('ReadingTabComponent', () => {
  const setup = (muted?: string) => {
    localStorage.clear();
    if (muted) localStorage.setItem('rssreader:muted-words', muted);
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(ReadingTabComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement, settings: TestBed.inject(SettingsStore) };
  };

  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('switches the theme', () => {
    const { fixture, root, settings } = setup();
    const swatches = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]'));
    expect(swatches).toHaveLength(12);
    expect(swatches[0].getAttribute('aria-checked')).toBe('true');
    swatches[1].click();
    expect(settings.theme()).toBe('light');
    swatches[3].click();
    expect(settings.theme()).toBe('sepia');
    fixture.detectChanges();
    expect(document.documentElement.dataset['theme']).toBe('sepia');
    swatches[0].click();
    expect(settings.theme()).toBe('dark');
  });

  it('changes the language', () => {
    const { root, settings } = setup();
    const select = root.querySelector<HTMLSelectElement>('select[name="language"]')!;
    expect(Array.from(select.options).map((o) => o.textContent?.trim())).toEqual(
      expect.arrayContaining(['Français', 'English', 'Español', 'Deutsch', 'العربية']),
    );
    expect(select.options).toHaveLength(6);
    select.value = 'de';
    select.dispatchEvent(new Event('change'));
    expect(settings.language()).toBe('de');
  });

  it('changes the font size, muted words and retention', () => {
    const { root, settings } = setup();
    const [, size, retention] = Array.from(root.querySelectorAll<HTMLSelectElement>('select'));
    size.value = size.options[5].value;
    size.dispatchEvent(new Event('change'));
    expect(settings.fontSize()).toBe(20);
    retention.value = retention.options[1].value;
    retention.dispatchEvent(new Event('change'));
    expect(settings.retentionDays()).toBe(7);

    const area = root.querySelector<HTMLTextAreaElement>('textarea')!;
    area.value = 'Foo\n\n Bar ';
    area.dispatchEvent(new Event('input'));
    expect(settings.mutedWords()).toEqual(['foo', 'bar']);
  });

  it('shows existing muted words', async () => {
    const { fixture, root } = setup('["a","b"]');
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('a\nb');
  });
});
