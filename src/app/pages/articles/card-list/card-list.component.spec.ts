import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { Article } from '../../../rss/models';
import { ArticleCardComponent } from '../article-card/article-card.component';
import { CardListComponent } from './card-list.component';

@Component({ selector: 'rss-article-card', template: '{{ article().id }}' })
class CardStub {
  readonly article = input.required<Article>();
}

describe('CardListComponent', () => {
  it('renders one card per article', () => {
    TestBed.overrideComponent(CardListComponent, { remove: { imports: [ArticleCardComponent] }, add: { imports: [CardStub] } });
    const fixture = TestBed.createComponent(CardListComponent);
    fixture.componentRef.setInput('articles', [{ id: 'a' }, { id: 'b' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('rss-article-card')).toHaveLength(2);
  });
});
