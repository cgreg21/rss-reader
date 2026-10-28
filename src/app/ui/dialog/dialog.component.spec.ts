import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { DialogService } from './dialog.service';
import { DialogComponent } from './dialog.component';

describe('DialogComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(DialogComponent);
    fixture.detectChanges();
    return { fixture, dialog: TestBed.inject(DialogService), root: fixture.nativeElement as HTMLElement };
  };

  it('renders nothing without dialog', () => {
    expect(setup().root.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders buttons and resolves with the clicked value', async () => {
    const { fixture, dialog, root } = setup();
    const p = dialog.confirm('Sure?', { title: 'T', danger: true });
    fixture.detectChanges();
    expect(root.querySelector('h2')?.textContent).toBe('T');
    expect(root.querySelector('p')?.textContent).toBe('Sure?');
    const buttons = root.querySelectorAll<HTMLButtonElement>('button');
    expect(buttons[1].className).toContain('bg-red-500');
    expect(buttons[0].className).toBe('btn-ghost');
    buttons[1].click();
    expect(await p).toBe(true);
    fixture.detectChanges();
    expect(root.querySelector('[role="dialog"]')).toBeNull();
  });

  it('dismisses with backdrop and Escape, but not from inside the dialog', async () => {
    const { fixture, dialog, root } = setup();
    let p = dialog.confirm('a');
    fixture.detectChanges();
    root.querySelector<HTMLElement>('[role="dialog"]')!.click();
    expect(dialog.current()).not.toBeNull();
    root.querySelector<HTMLElement>('.fixed')!.click();
    expect(await p).toBe(false);

    p = dialog.confirm('b');
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(await p).toBe(false);
  });

  it('handles the text field and focuses it', async () => {
    const { fixture, dialog, root } = setup();
    const p = dialog.prompt('Name?', { value: 'x', placeholder: 'ph', type: 'password' });
    fixture.detectChanges();
    await Promise.resolve();
    const input = root.querySelector<HTMLInputElement>('input')!;
    expect(input.type).toBe('password');
    expect(input.placeholder).toBe('ph');
    input.value = 'typed';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(await p).toBe('typed');
  });

  it('uses default input type, placeholder and aria-label', () => {
    const { fixture, dialog, root } = setup();
    void dialog.open({ buttons: [], dismissValue: 0, input: {} });
    fixture.detectChanges();
    expect(root.querySelector<HTMLInputElement>('input')!.type).toBe('text');
    expect(root.querySelector('h2')).toBeNull();
    expect(root.querySelector('p')).toBeNull();
  });
});
