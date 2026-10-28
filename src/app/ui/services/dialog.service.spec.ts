import { describe, expect, it } from 'vitest';

import { DialogService } from './dialog.service';

describe('DialogService', () => {
  it('resolves alert with the OK button', async () => {
    const d = new DialogService();
    const p = d.alert('msg', 'title');
    expect(d.current()).toMatchObject({ title: 'title', message: 'msg' });
    d.close(undefined);
    await expect(p).resolves.toBeUndefined();
    expect(d.current()).toBeNull();
  });

  it('confirms, cancels and dismisses', async () => {
    const d = new DialogService();
    let p = d.confirm('ok?', { danger: true, confirmLabel: 'Yes', cancelLabel: 'No' });
    expect(d.current()?.buttons.map((b) => [b.label, b.kind])).toEqual([['No', 'ghost'], ['Yes', 'danger']]);
    d.close(true);
    expect(await p).toBe(true);
    p = d.confirm('ok?');
    expect(d.current()?.buttons[1]).toMatchObject({ label: 'Confirmer', kind: 'primary' });
    d.dismiss();
    expect(await p).toBe(false);
    d.dismiss();
  });

  it('prompts for text', async () => {
    const d = new DialogService();
    let p = d.prompt('name?', { value: 'init', confirmLabel: 'Go' });
    expect(d.current()?.text).toBe('init');
    d.setText('typed');
    d.close(true);
    expect(await p).toBe('typed');
    p = d.prompt('name?');
    d.setText('x');
    d.dismiss();
    expect(await p).toBeNull();
    d.setText('ignored');
  });

  it('closing without a dialog is a no-op, and opening replaces the previous one', async () => {
    const d = new DialogService();
    d.close(1);
    const first = d.confirm('a');
    const second = d.confirm('b');
    expect(await first).toBe(false);
    d.close(true);
    expect(await second).toBe(true);
  });
});
