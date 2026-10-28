import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncService } from '../../../pwa/services/sync.service';
import { RssStore } from '../../../rss/rss.store';
import { LibraryService } from '../../../rss/services/library.service';
import { SyncTabComponent } from './sync-tab.component';

describe('SyncTabComponent', () => {
  const sync = {
    busy: signal(false), enabled: signal(true), stopped: signal(false), error: signal(''), lastSync: signal<number | null>(null), code: signal(''),
    resume: vi.fn(), setCode: vi.fn(), generateCode: vi.fn(),
  };
  const store = { feeds: signal<unknown[]>([{}]) };
  const library = { importBackup: vi.fn(), exportBackup: vi.fn(() => '{}') };

  beforeEach(() => {
    sync.error.set('');
    sync.lastSync.set(null);
    sync.code.set('');
    sync.enabled.set(true);
    store.feeds.set([{}]);
    [sync.resume, sync.setCode, sync.generateCode].forEach((fn) => fn.mockReset());
    library.importBackup.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: SyncService, useValue: sync }, { provide: RssStore, useValue: store }, { provide: LibraryService, useValue: library }],
    });
  });

  const setup = () => {
    const fixture = TestBed.createComponent(SyncTabComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };
  const fileEvent = (root: HTMLElement, text: string | null) => {
    const input = root.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', { configurable: true, value: text === null ? [] : [new File([text], 'b.json')] });
    input.dispatchEvent(new Event('change'));
  };

  it('manages the pin code and manual sync', () => {
    const { root } = setup();
    root.querySelector<HTMLButtonElement>('[aria-label="Synchroniser maintenant"]')!.click();
    expect(sync.resume).toHaveBeenCalled();
    root.querySelector<HTMLButtonElement>('.btn-ghost')!.click();
    expect(sync.generateCode).toHaveBeenCalled();
    const input = root.querySelector<HTMLInputElement>('input[name="syncCode"]')!;
    input.value = '1234';
    input.dispatchEvent(new Event('input'));
    expect(sync.setCode).toHaveBeenCalledWith('1234');
  });

  it('shows the status messages', () => {
    const { fixture, root } = setup();
    sync.error.set('bad');
    fixture.detectChanges();
    expect(root.textContent).toContain('bad');
    sync.error.set('');
    sync.lastSync.set(Date.now());
    fixture.detectChanges();
    expect(root.textContent).toMatch(/\d\d:\d\d:\d\d/);
    sync.lastSync.set(null);
    sync.code.set('12');
    sync.enabled.set(false);
    fixture.detectChanges();
    expect(root.textContent).toContain('incomplet');
  });

  it('restores a backup', async () => {
    const { fixture, root } = setup();
    library.importBackup.mockResolvedValueOnce({ feeds: 2 });
    fileEvent(root, '{}');
    await vi.waitFor(() => expect(root.textContent).toBeDefined());
    await fixture.whenStable();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('2 flux');
    });
    library.importBackup.mockRejectedValueOnce(new Error('Sauvegarde invalide'));
    fileEvent(root, 'x');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('invalide');
    });
    library.importBackup.mockRejectedValueOnce('weird');
    fileEvent(root, 'x');
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(root.textContent).toContain('Import impossible');
    });
    fileEvent(root, null);
    expect(library.importBackup).toHaveBeenCalledTimes(3);
  });

  it('exports a backup file', () => {
    const spy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const { root } = setup();
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Sauvegarder'))!;
    button.click();
    expect(spy).toHaveBeenCalled();
    expect(library.exportBackup).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
