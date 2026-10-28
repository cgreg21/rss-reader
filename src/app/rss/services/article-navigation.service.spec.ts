import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { Article } from '../models';
import { ArticlesStore } from '../stores/articles.store';
import { ViewStore } from '../stores/view.store';
import { ArticleNavigationService } from './article-navigation.service';

const art = (id: string): Article => ({ id, feedId: 'f', title: `T${id}`, link: '', summary: '', content: '', published: 1, read: false, favorite: false });

describe('ArticleNavigationService', () => {
  const articles = signal<Article[]>([art('a'), art('b'), art('c')]);
  const store = { visible: signal<Article[]>(articles()), article: (id: string) => articles().find((a) => a.id === id) };
  let nav: ArticleNavigationService;

  beforeEach(() => {
    store.visible.set(articles());
    TestBed.configureTestingModule({ providers: [{ provide: ArticlesStore, useValue: store }, { provide: ViewStore, useValue: store }] });
    nav = TestBed.inject(ArticleNavigationService);
  });

  it('has no neighbours before an article opens', () => {
    expect(nav.previous()).toBeUndefined();
    expect(nav.next()).toBeUndefined();
  });

  it('follows the visible list and keeps it while moving inside it', () => {
    nav.open('b');
    expect(nav.previous()?.id).toBe('a');
    expect(nav.next()?.id).toBe('c');
    store.visible.set([art('c')]);
    nav.open('c');
    expect(nav.previous()?.id).toBe('b');
    expect(nav.next()).toBeUndefined();
  });

  it('re-reads the list when opening an article outside the snapshot or after closing', () => {
    nav.open('a');
    store.visible.set([art('c'), art('b')]);
    nav.open('x');
    expect(nav.previous()).toBeUndefined();
    expect(nav.next()).toBeUndefined();
    nav.open('b');
    expect(nav.previous()?.id).toBe('c');
    nav.close();
    expect(nav.previous()).toBeUndefined();
    store.visible.set([art('b'), art('a')]);
    nav.open('b');
    expect(nav.previous()).toBeUndefined();
    expect(nav.next()?.id).toBe('a');
  });
});
