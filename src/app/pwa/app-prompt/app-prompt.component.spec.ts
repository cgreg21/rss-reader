import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../ui/snackbar/snackbar.service';
import { InstallService } from '../services/install.service';
import { UpdateService } from '../services/update.service';
import { AppPromptComponent } from './app-prompt.component';
import { signal } from '@angular/core';

describe('AppPromptComponent', () => {
  const snackbar = { show: vi.fn(), dismiss: vi.fn() };
  const available = signal(false);
  const dismissed = signal(false);
  const banner = signal(false);
  const updates = { available, dismissed, apply: vi.fn(), dismiss: vi.fn() };
  const install = { banner, install: vi.fn(), dismiss: vi.fn() };

  beforeEach(() => {
    available.set(false);
    dismissed.set(false);
    banner.set(false);
    snackbar.show.mockReset().mockReturnValue(7);
    snackbar.dismiss.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SnackbarService, useValue: snackbar },
        { provide: InstallService, useValue: install },
        { provide: UpdateService, useValue: updates },
      ],
    });
  });
  afterEach(() => vi.clearAllMocks());

  const actionsOf = () => snackbar.show.mock.calls.at(-1)![1].actions as { label: string; run: () => void }[];

  it('offers an update, then falls back to install', () => {
    TestBed.createComponent(AppPromptComponent);
    TestBed.tick();
    expect(snackbar.show).not.toHaveBeenCalled();

    available.set(true);
    TestBed.tick();
    expect(snackbar.show).toHaveBeenCalledTimes(1);
    actionsOf()[0].run();
    actionsOf()[1].run();
    expect(updates.apply).toHaveBeenCalled();
    expect(updates.dismiss).toHaveBeenCalled();

    banner.set(true);
    dismissed.set(true);
    TestBed.tick();
    expect(snackbar.dismiss).toHaveBeenCalledWith(7);
    expect(snackbar.show).toHaveBeenCalledTimes(2);
    actionsOf()[0].run();
    actionsOf()[1].run();
    expect(install.install).toHaveBeenCalled();
    expect(install.dismiss).toHaveBeenCalled();

    banner.set(false);
    TestBed.tick();
    expect(snackbar.show).toHaveBeenCalledTimes(2);
  });
});
