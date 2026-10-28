import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../ui/snackbar/snackbar.service';
import { ArticlesStore } from '../stores/articles.store';
import { FullTextService } from './full-text.service';

describe('FullTextService', () => {
  const store = { fetchFullText: vi.fn() };
  const snackbar = { show: vi.fn(), error: vi.fn() };
  let service: FullTextService;

  beforeEach(() => {
    store.fetchFullText.mockReset();
    snackbar.show.mockReset();
    snackbar.error.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ArticlesStore, useValue: store }, { provide: SnackbarService, useValue: snackbar }] });
    service = TestBed.inject(FullTextService);
  });

  it('tracks the loading article and reports success', async () => {
    let done!: () => void;
    store.fetchFullText.mockReturnValue(new Promise<void>((r) => (done = r)));
    const load = service.load('a');
    expect(service.loading('a')).toBe(true);
    expect(service.loading('b')).toBe(false);
    void service.load('b');
    expect(store.fetchFullText).toHaveBeenCalledTimes(1);
    done();
    await load;
    expect(service.loading('a')).toBe(false);
    expect(snackbar.show).toHaveBeenCalledWith('Texte complet chargé');
  });

  it('reports failures', async () => {
    store.fetchFullText.mockRejectedValueOnce(new Error('nope'));
    await service.load('a');
    expect(snackbar.error).toHaveBeenCalledWith('nope');
    store.fetchFullText.mockRejectedValueOnce('weird');
    await service.load('a');
    expect(snackbar.error).toHaveBeenCalledWith('Chargement impossible');
    expect(service.loading('a')).toBe(false);
  });
});
