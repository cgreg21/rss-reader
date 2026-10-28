import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { I18nService } from '../../i18n/services/i18n.service';
import { MessageKey } from '../../i18n/messages';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { AddFeedDialogService } from '../add-feed-dialog/add-feed-dialog.service';
import { AxisGesture, isPrimaryPress } from '../gestures/pointer-gestures';
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

/** Horizontal distance after which releasing the finger changes the slide. */
const SWIPE_MIN_PX = 60;
/** How much a slide follows the finger when there is nothing beyond it. */
const RUBBER_BAND = 3;

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
  /** Whether the current slide's content cascades in; off after a swipe since the slide was already in view. */
  protected readonly staggered = signal(true);
  protected readonly slide = computed(() => this.slides[this.index()]);
  protected readonly last = computed(() => this.index() === this.slides.length - 1);
  /** Horizontal shift of the slide track while a finger drags it, in px. */
  protected readonly offset = signal(0);
  private readonly gesture = new AxisGesture();

  constructor() {
    effect(() => {
      if (this.onboarding.opened()) {
        this.index.set(0);
        this.staggered.set(true);
      }
    });
  }

  protected go(i: number, staggered = true): void {
    if (i === this.index()) return;
    this.staggered.set(staggered);
    this.index.set(i);
  }

  protected step(delta: number, staggered = true): void {
    this.go(Math.min(this.slides.length - 1, Math.max(0, this.index() + delta)), staggered);
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

  protected onDown(e: PointerEvent): void {
    if (isPrimaryPress(e)) this.gesture.start(e);
  }

  protected onMove(e: PointerEvent, card: HTMLElement): void {
    const move = this.gesture.move(e);
    if (move?.axis !== 'horizontal') return;
    if (move.started) card.setPointerCapture?.(e.pointerId);
    const forward = move.dx * this.i18n.sign() < 0;
    const blocked = forward ? this.last() : this.index() === 0;
    this.offset.set(blocked ? move.dx / RUBBER_BAND : move.dx);
  }

  protected onUp(e: PointerEvent, card: HTMLElement): void {
    const end = this.gesture.end(e);
    this.offset.set(0);
    if (end?.axis !== 'horizontal') return;
    card.releasePointerCapture?.(e.pointerId);
    const dx = end.dx * this.i18n.sign();
    if (Math.abs(dx) >= SWIPE_MIN_PX) this.step(dx < 0 ? 1 : -1, false);
  }
}
