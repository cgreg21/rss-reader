import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { UI_ICONS } from './icons';

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
  template: `
    @if (open()) { <div class="pointer-events-auto fixed inset-0 -z-10" (click)="open.set(false)"></div> }
    <div class="pointer-events-auto relative size-14">
      @for (p of placed(); track p.item.label) {
        @if (p.item.route) {
          <a class="radial-item" [class]="p.item.activeClass ?? ''" [routerLink]="p.item.route" [attr.aria-label]="p.item.label" [style]="style(p)" (click)="open.set(false)">{{ p.item.icon }}</a>
        } @else if (p.item.href) {
          <a class="radial-item" [href]="p.item.href" target="_blank" rel="noopener noreferrer" [attr.aria-label]="p.item.label" [style]="style(p)" (click)="open.set(false)">{{ p.item.icon }}</a>
        } @else {
          <button class="radial-item" type="button" [class]="p.item.activeClass ?? ''" [class.animate-pulse]="p.item.pulse" [disabled]="p.item.disabled"
            [attr.aria-label]="p.item.label" [style]="style(p)" (click)="p.item.run?.()">{{ p.item.icon }}</button>
        }
      }
      <button class="absolute inset-0 grid cursor-pointer place-items-center rounded-full bg-accent font-mdi text-[28px] text-white shadow-lg transition-transform active:scale-90"
        type="button" [attr.aria-expanded]="open()" aria-label="Actions" (click)="open.set(!open())">{{ open() ? ui.close : ui.menu }}</button>
    </div>
  `,
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
