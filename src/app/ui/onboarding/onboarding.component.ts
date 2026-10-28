import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../i18n/services/i18n.service';
import { MessageKey } from '../../i18n/messages';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { AddFeedDialogService } from '../add-feed-dialog/add-feed-dialog.service';
import { UI_ICONS } from '../icons';
import { OnboardingService } from './onboarding.service';

interface Slide {
  id: string;
  icon: string;
  title: MessageKey;
  text: MessageKey;
  /** Optional shortcut that closes the carousel and starts the configuration step. */
  action?: { label: MessageKey; run: () => void };
}

const SWIPE_MIN_PX = 40;

/** Presentation and setup help carousel; place it once in the root layout. */
@Component({
  selector: 'rss-onboarding',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'contents',
    '(document:keydown.escape)': 'onboarding.opened() && skip()',
    '(document:keydown.arrowright)': 'onboarding.opened() && step(i18n.sign())',
    '(document:keydown.arrowleft)': 'onboarding.opened() && step(-i18n.sign())',
  },
  templateUrl: './onboarding.component.html',
})
export class OnboardingComponent {
  protected readonly onboarding = inject(OnboardingService);
  protected readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly addFeed = inject(AddFeedDialogService);
  protected readonly slides: readonly Slide[] = [
    { id: 'welcome', icon: UI_ICONS.all, title: 'onboarding.welcomeTitle', text: 'onboarding.welcomeText' },
    { id: 'feeds', icon: UI_ICONS.add, title: 'onboarding.feedsTitle', text: 'onboarding.feedsText', action: { label: 'onboarding.addFeed', run: () => this.addFeed.open() } },
    { id: 'reading', icon: UI_ICONS.reader, title: 'onboarding.readingTitle', text: 'onboarding.readingText' },
    { id: 'offline', icon: UI_ICONS.download, title: 'onboarding.offlineTitle', text: 'onboarding.offlineText' },
    { id: 'sync', icon: UI_ICONS.settings, title: 'onboarding.syncTitle', text: 'onboarding.syncText', action: { label: 'onboarding.openOptions', run: () => void this.router.navigateByUrl('/options') } },
  ];
  protected readonly index = signal(0);
  protected readonly slide = computed(() => this.slides[this.index()]);
  protected readonly last = computed(() => this.index() === this.slides.length - 1);
  private touchX: number | null = null;

  constructor() {
    effect(() => {
      if (this.onboarding.opened()) this.index.set(0);
    });
  }

  protected step(delta: number): void {
    this.index.update((i) => Math.min(this.slides.length - 1, Math.max(0, i + delta)));
  }

  protected next(): void {
    if (this.last()) this.onboarding.dismiss();
    else this.step(1);
  }

  protected skip(): void {
    this.onboarding.dismiss();
  }

  protected run(slide: Slide): void {
    this.onboarding.dismiss();
    slide.action?.run();
  }

  protected touchStart(e: TouchEvent): void {
    this.touchX = e.touches[0]?.clientX ?? null;
  }

  protected touchEnd(e: TouchEvent): void {
    const x = e.changedTouches[0]?.clientX;
    if (this.touchX === null || x === undefined) return;
    const dx = (x - this.touchX) * this.i18n.sign();
    this.touchX = null;
    if (Math.abs(dx) >= SWIPE_MIN_PX) this.step(dx < 0 ? 1 : -1);
  }
}
