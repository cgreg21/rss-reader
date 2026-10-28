import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { SettingsStore } from '../../../rss/settings.store';

/** Options tab: theme, font size, muted words and read-article purge. */
@Component({
  selector: 'rss-reading-tab',
  host: { class: 'block' },
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reading-tab.component.html',
})
export class ReadingTabComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly retentionOptions = [7, 30, 90];
  protected readonly fontSizes = [14, 15, 16, 17, 18, 20, 22];

  protected mutedText(): string {
    return this.settings.mutedWords().join('\n');
  }

  protected setMuted(text: string): void {
    this.settings.setMutedWords(text.split('\n'));
  }
}
