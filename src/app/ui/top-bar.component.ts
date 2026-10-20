import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';

import { RssStore } from '../rss/rss.store';
import { DrawerService } from './drawer.service';
import { UI_ICONS } from './icons';

/** Mobile/portrait header: drawer button, current scope title and refresh. */
@Component({
  selector: 'rss-top-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  templateUrl: './top-bar.component.html',
})
export class TopBarComponent {
  protected readonly store = inject(RssStore);
  protected readonly drawer = inject(DrawerService);
  protected readonly ui = UI_ICONS;
  protected readonly searching = signal(this.store.search() !== '');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => this.field()?.nativeElement.focus());
  }

  protected toggleSearch(): void {
    if (this.searching()) this.store.search.set('');
    this.searching.update((open) => !open);
  }
}
