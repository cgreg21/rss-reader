import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';

import { SettingsStore } from '../rss/settings.store';
import { LocalDatePipe } from './local-date.pipe';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'rss-pipes-host',
  imports: [TranslatePipe, LocalDatePipe],
  template: `<p id="t">{{ 'common.cancel' | translate }}</p><p id="d">{{ when | localDate }}</p><p id="h">{{ when | localDate: 'time' }}</p>`,
})
class HostComponent {
  when = new Date(2025, 0, 31, 14, 5, 9);
}

describe('translate and localDate pipes', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('follow the selected language', () => {
    localStorage.clear();
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(HostComponent);
    const settings = TestBed.inject(SettingsStore);
    const text = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`#${id}`)!.textContent;
    settings.language.set('fr');
    fixture.detectChanges();
    expect(text('t')).toBe('Annuler');
    expect(text('d')).toContain('31/01/2025');
    settings.language.set('en');
    fixture.detectChanges();
    expect(text('t')).toBe('Cancel');
    expect(text('d')).toContain('1/31/25');
    expect(text('h')).toContain('2:05:09');
  });
});
