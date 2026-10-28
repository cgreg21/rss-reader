import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LANGUAGES, LANGUAGE_NAMES } from '../../../i18n/languages';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { SettingsStore } from '../../../rss/stores/settings.store';

/** Options tab: theme, font size, muted words and read-article purge. */
@Component({
  selector: 'rss-reading-tab',
  host: { class: 'block' },
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reading-tab.component.html',
})
export class ReadingTabComponent {
  protected readonly settings = inject(SettingsStore);
  protected readonly languages = LANGUAGES.map((id) => ({ id, name: LANGUAGE_NAMES[id] }));
  protected readonly retentionOptions = [7, 30, 90];
  protected readonly fontSizes = [14, 15, 16, 17, 18, 20, 22];

  protected mutedText(): string {
    return this.settings.mutedWords().join('\n');
  }

  protected setMuted(text: string): void {
    this.settings.setMutedWords(text.split('\n'));
  }
}
