import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { FeedsPage } from './feeds.page';

@Component({ selector: 'rss-feeds-tab', template: 'feeds-tab' })
class FeedsTabStub {}
@Component({ selector: 'rss-reading-tab', template: 'reading-tab' })
class ReadingTabStub {}
@Component({ selector: 'rss-sync-tab', template: 'sync-tab' })
class SyncTabStub {}
@Component({ selector: 'rss-system-tab', template: 'system-tab' })
class SystemTabStub {}
@Component({ selector: 'rss-about', template: 'about' })
class AboutStub {}

import { AboutPage } from '../about/about.page';
import { FeedsTabComponent } from '../options/feeds-tab/feeds-tab.component';
import { ReadingTabComponent } from '../options/reading-tab/reading-tab.component';
import { SyncTabComponent } from '../options/sync-tab/sync-tab.component';
import { SystemTabComponent } from '../options/system-tab/system-tab.component';

describe('FeedsPage', () => {
  it('switches between the option tabs', () => {
    TestBed.overrideComponent(FeedsPage, {
      remove: { imports: [FeedsTabComponent, ReadingTabComponent, SyncTabComponent, SystemTabComponent, AboutPage] },
      add: { imports: [FeedsTabStub, ReadingTabStub, SyncTabStub, SystemTabStub, AboutStub] },
    });
    const fixture = TestBed.createComponent(FeedsPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tabs = root.querySelectorAll<HTMLButtonElement>('nav button');
    expect(tabs).toHaveLength(5);
    expect(root.querySelector('rss-feeds-tab')).not.toBeNull();
    const expected = ['rss-feeds-tab', 'rss-reading-tab', 'rss-sync-tab', 'rss-system-tab', 'rss-about'];
    tabs.forEach((tab, i) => {
      tab.click();
      fixture.detectChanges();
      expect(root.querySelector(expected[i])).not.toBeNull();
      expect(tab.getAttribute('aria-current')).toBe('page');
    });
  });
});
