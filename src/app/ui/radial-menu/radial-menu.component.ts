import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { I18nService } from '../../i18n/services/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UI_ICONS } from '../icons';

export interface RadialItem {
  label: string;
  icon: string;
  run?: () => void;
  href?: string;
  activeClass?: string;
  disabled?: boolean;
  pulse?: boolean;
}

/** Icon-only fan menu opened from a button at the bottom center of the screen. */
@Component({
  selector: 'rss-radial-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  host: { class: 'pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 flex justify-center sidebar:hidden' },
  templateUrl: './radial-menu.component.html',
})
export class RadialMenuComponent {
  readonly items = input.required<RadialItem[]>();
  protected readonly open = signal(false);
  protected readonly ui = UI_ICONS;
  protected readonly i18n = inject(I18nService);
  protected readonly placed = computed(() => {
    const items = this.items();
    const sign = this.i18n.sign();
    const radius = items.length > 4 ? 40 + items.length * 10 : 72;
    return items.map((item, i) => {
      const angle = items.length === 1 ? Math.PI / 2 : Math.PI - (i * Math.PI) / (items.length - 1);
      return { item, i, x: Math.round(Math.cos(angle) * radius) * sign || 0, y: Math.round(Math.sin(angle) * radius) };
    });
  });

  protected style(p: { x: number; y: number; i: number }): string {
    return this.open()
      ? `transform: translate(${p.x}px, ${-p.y}px); opacity: 1; transition-delay: ${p.i * 25}ms;`
      : 'transform: translate(0, 0) scale(0.4); opacity: 0; pointer-events: none;';
  }
}
