import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, viewChild } from '@angular/core';

import { DialogService } from '../services/dialog.service';

/** Renders the current dialog; place it once in the root layout. */
@Component({
  selector: 'rss-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents', '(document:keydown.escape)': 'dialog.dismiss()' },
  templateUrl: './dialog.component.html',
})
export class DialogComponent {
  protected readonly dialog = inject(DialogService);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => {
      const el = this.field()?.nativeElement;
      if (el) queueMicrotask(() => { el.focus(); el.select(); });
    });
  }
}
