import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AddFeedDialogService } from '../add-feed-dialog/add-feed-dialog.service';
import { OnboardingComponent } from './onboarding.component';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('opens on the first launch only, and can be replayed', () => {
    const first = TestBed.inject(OnboardingService);
    expect(first.opened()).toBe(true);
    first.dismiss();
    expect(first.opened()).toBe(false);
    TestBed.resetTestingModule();
    const second = TestBed.inject(OnboardingService);
    expect(second.opened()).toBe(false);
    second.show();
    expect(second.opened()).toBe(true);
  });
});

describe('OnboardingComponent', () => {
  const addFeed = { open: vi.fn() };

  beforeEach(() => {
    localStorage.clear();
    addFeed.open.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }]), { provide: AddFeedDialogService, useValue: addFeed }] });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (text: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === text)!;
    return { fixture, root, button, service: TestBed.inject(OnboardingService) };
  };

  it('walks through the slides and closes at the end', () => {
    const { fixture, root, button, service } = setup();
    expect(root.textContent).toContain('Bienvenue');
    expect(root.textContent).toContain('1 / 5');
    expect(button('Précédent').classList.contains('invisible')).toBe(true);
    for (let i = 0; i < 4; i++) { button('Suivant').click(); fixture.detectChanges(); }
    expect(root.textContent).toContain('5 / 5');
    expect(root.textContent).toContain('Synchronisez');
    button('Commencer').click();
    fixture.detectChanges();
    expect(service.opened()).toBe(false);
    expect(root.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem('rssreader:onboarded')).toBe('1');
  });

  it('can be skipped and starts again from the first slide when replayed', () => {
    const { fixture, root, button, service } = setup();
    button('Suivant').click();
    fixture.detectChanges();
    button('Passer').click();
    fixture.detectChanges();
    expect(service.opened()).toBe(false);
    service.show();
    fixture.detectChanges();
    expect(root.textContent).toContain('1 / 5');
  });

  it('jumps with the dots, the keyboard and swipes', () => {
    const { fixture, root } = setup();
    root.querySelectorAll<HTMLButtonElement>('[role="tab"]')[2].click();
    fixture.detectChanges();
    expect(root.textContent).toContain('3 / 5');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    fixture.detectChanges();
    expect(root.textContent).toContain('2 / 5');
    const dialog = root.querySelector<HTMLElement>('[role="dialog"]')!;
    const touch = (type: string, x: number) => {
      const e = new Event(type, { bubbles: true });
      Object.assign(e, { touches: [{ clientX: x }], changedTouches: [{ clientX: x }] });
      dialog.dispatchEvent(e);
    };
    touch('touchstart', 200);
    touch('touchend', 100);
    fixture.detectChanges();
    expect(root.textContent).toContain('3 / 5');
    touch('touchstart', 100);
    touch('touchend', 110);
    fixture.detectChanges();
    expect(root.textContent).toContain('3 / 5');
  });

  it('runs the slide shortcuts after closing', async () => {
    const { fixture, button, service } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    button('Suivant').click();
    fixture.detectChanges();
    button('Ajouter un flux').click();
    fixture.detectChanges();
    expect(service.opened()).toBe(false);
    expect(addFeed.open).toHaveBeenCalled();
    service.show();
    fixture.detectChanges();
    for (let i = 0; i < 4; i++) { button('Suivant').click(); fixture.detectChanges(); }
    button('Ouvrir les options').click();
    expect(navigate).toHaveBeenCalledWith('/options');
    expect(service.opened()).toBe(false);
  });
});
