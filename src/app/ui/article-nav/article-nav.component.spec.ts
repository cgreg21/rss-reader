import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';

import { Article } from '../../rss/models';
import { ArticleNavigationService } from '../../rss/services/article-navigation.service';
import { ArticleNavComponent } from './article-nav.component';

describe('ArticleNavComponent', () => {
  it('links to the previous and next articles, greying out missing ones', () => {
    const previous = signal<Article | undefined>(undefined);
    const next = signal<Article | undefined>({ id: 'n', title: 'Next one' } as Article);
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ArticleNavigationService, useValue: { previous, next } }] });
    const fixture = TestBed.createComponent(ArticleNavComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = () => Array.from(el.querySelectorAll('a'));
    expect(links()).toHaveLength(1);
    expect(links()[0].getAttribute('href')).toBe('/article/n');
    expect(links()[0].getAttribute('aria-label')).toBe('Suivant · Next one');
    expect(el.querySelectorAll('span[aria-hidden]')).toHaveLength(1);
    previous.set({ id: 'p', title: 'P' } as Article);
    next.set(undefined);
    fixture.detectChanges();
    expect(links()[0].getAttribute('href')).toBe('/article/p');
    expect(links()[0].getAttribute('aria-label')).toBe('Précédent · P');
  });
});
