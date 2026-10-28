import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UI_ICONS } from '../icons';

export interface RadialItem {
  label: string;
  icon: string;
  run?: () => void;
  route?: string;
  href?: string;
  activeClass?: string;
  disabled?: boolean;
  pulse?: boolean;
}

/** Icon-only fan menu opened from a button at the bottom center of the screen. */
@Component({
  selector: 'rss-radial-menu',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 flex justify-center sidebar:hidden' },
  templateUrl: './radial-menu.component.html',
})
export class RadialMenuComponent {
  readonly items = input.required<RadialItem[]>();
  protected readonly open = signal(false);
  protected readonly ui = UI_ICONS;
  protected readonly placed = computed(() => {
    const items = this.items();
    const radius = items.length > 4 ? 40 + items.length * 10 : 72;
    return items.map((item, i) => {
      const angle = items.length === 1 ? Math.PI / 2 : Math.PI - (i * Math.PI) / (items.length - 1);
      return { item, x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius) };
    });
  });

  protected style(p: { x: number; y: number }): string {
    return this.open()
      ? `transform: translate(${p.x}px, ${-p.y}px); opacity: 1;`
      : 'transform: translate(0, 0) scale(0.4); opacity: 0; pointer-events: none;';
  }
}
