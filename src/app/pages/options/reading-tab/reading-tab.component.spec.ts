import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { SettingsStore } from '../../../rss/settings.store';
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

  it('switches the theme', () => {
    const { root, settings } = setup();
    const [dark, light] = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="group"] button'));
    light.click();
    expect(settings.theme()).toBe('light');
    dark.click();
    expect(settings.theme()).toBe('dark');
  });

  it('changes the font size, muted words and retention', () => {
    const { root, settings } = setup();
    const [size, retention] = Array.from(root.querySelectorAll<HTMLSelectElement>('select'));
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
