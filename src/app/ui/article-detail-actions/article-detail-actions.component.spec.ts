import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Article } from '../../rss/models';
import { ArticlesStore } from '../../rss/articles.store';
import { SnackbarService } from '../services/snackbar.service';
import { ArticleDetailActionsComponent } from './article-detail-actions.component';

const base: Article = { id: 'a1', feedId: 'f', title: 'Title', link: 'https://a.com/1', summary: 'sum', content: '<p>body</p>', published: 1, read: false, favorite: false };

describe('ArticleDetailActionsComponent', () => {
  const article = signal<Article | undefined>(base);
  const store = { article: () => article(), patch: vi.fn(), toggle: vi.fn(), fetchFullText: vi.fn() };
  const snackbar = { show: vi.fn(), error: vi.fn() };
  let utterances: { onend?: () => void; onerror?: () => void; lang?: string; text: string }[] = [];
  const synth = { speak: vi.fn(), cancel: vi.fn() };

  beforeEach(() => {
    article.set(base);
    store.toggle.mockReset();
    store.patch.mockReset();
    store.fetchFullText.mockReset().mockResolvedValue(undefined);
    snackbar.show.mockReset();
    snackbar.error.mockReset();
    utterances = [];
    synth.speak.mockReset();
    synth.cancel.mockReset();
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      onend?: () => void;
      onerror?: () => void;
      lang?: string;
      constructor(public text: string) {
        utterances.push(this);
      }
    });
    Object.assign(navigator, { share: vi.fn().mockResolvedValue(undefined), clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', children: [] }]), { provide: ArticlesStore, useValue: store }, { provide: SnackbarService, useValue: snackbar }],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (navigator as { share?: unknown }).share;
  });

  const setup = (inputs: { radial?: boolean; overflow?: boolean } = {}) => {
    const fixture = TestBed.createComponent(ArticleDetailActionsComponent);
    fixture.componentRef.setInput('id', 'a1');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const btn = (label: string) => root.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
    return { fixture, root, btn };
  };

  it('toggles favorite, later and read', () => {
    const { btn } = setup();
    btn('Ajouter aux favoris').click();
    expect(store.toggle).toHaveBeenCalledWith(base, 'favorite');
    btn('Lire plus tard').click();
    expect(store.toggle).toHaveBeenCalledWith(base, 'later');
    btn('Basculer lu / non lu').click();
    expect(store.toggle).toHaveBeenCalledWith(base, 'read');
  });

  it('shows the active state', () => {
    article.set({ ...base, favorite: true, later: true, read: true, fullText: true });
    const { btn, root } = setup();
    btn('Retirer des favoris').click();
    expect(store.toggle).toHaveBeenCalledWith(expect.objectContaining({ favorite: true }), 'favorite');
    expect(root.querySelector('[aria-label="Charger le texte complet"]')).toBeNull();
  });

  it('renders nothing for an unknown article', () => {
    article.set(undefined);
    expect(setup().root.querySelectorAll('button')).toHaveLength(0);
    expect(setup({ radial: true }).root.querySelectorAll('.radial-item')).toHaveLength(0);
    expect(setup({ overflow: true }).root.querySelectorAll('button')).toHaveLength(0);
  });

  it('loads the full text, reporting success and errors', async () => {
    const { btn } = setup();
    btn('Charger le texte complet').click();
    await vi.waitFor(() => expect(snackbar.show).toHaveBeenCalled());
    store.fetchFullText.mockRejectedValueOnce(new Error('nope'));
    btn('Charger le texte complet').click();
    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('nope'));
    store.fetchFullText.mockRejectedValueOnce('weird');
    btn('Charger le texte complet').click();
    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('Chargement impossible'));
  });

  it('shares, ignoring aborts', async () => {
    const { btn } = setup();
    btn('Partager').click();
    await vi.waitFor(() => expect(navigator.share).toHaveBeenCalledWith({ title: 'Title', url: 'https://a.com/1' }));
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new DOMException('x', 'AbortError'));
    btn('Partager').click();
    await Promise.resolve();
    expect(snackbar.error).not.toHaveBeenCalled();
    (navigator.share as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new DOMException('x', 'NotAllowedError'));
    btn('Partager').click();
    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('Partage impossible'));
  });

  it('copies the link', async () => {
    const { btn } = setup();
    btn('Copier le lien').click();
    await vi.waitFor(() => expect(snackbar.show).toHaveBeenCalled());
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('x'));
    btn('Copier le lien').click();
    await vi.waitFor(() => expect(snackbar.error).toHaveBeenCalledWith('Copie impossible'));
  });

  it('reads aloud and stops', () => {
    const { fixture, btn } = setup();
    btn('Lire à voix haute').click();
    expect(synth.speak).toHaveBeenCalled();
    expect(utterances[0].text).toBe('Title. body');
    fixture.detectChanges();
    btn('Arrêter la lecture').click();
    expect(synth.cancel).toHaveBeenCalled();
    fixture.detectChanges();
    btn('Lire à voix haute').click();
    utterances[1].onend!();
    fixture.detectChanges();
    expect(btn('Lire à voix haute')).toBeTruthy();
    btn('Lire à voix haute').click();
    fixture.destroy();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
  });

  it('uses the summary when there is no content and hides link actions without a link', () => {
    article.set({ ...base, content: '', link: '' });
    const { btn, root, fixture } = setup();
    btn('Lire à voix haute').click();
    expect(utterances[0].text).toBe('Title. sum');
    expect(root.querySelector('[aria-label="Copier le lien"]')).toBeNull();
    expect(root.querySelector('[aria-label="Charger le texte complet"]')).toBeNull();
    fixture.destroy();
  });

  it('hides share and speech when unsupported', () => {
    delete (navigator as { share?: unknown }).share;
    const { root } = setup();
    expect(root.querySelector('[aria-label="Partager"]')).toBeNull();
  });

  it('builds the radial menu', async () => {
    const { root, fixture } = setup({ radial: true });
    const items = root.querySelectorAll<HTMLButtonElement>('.radial-item');
    expect(items).toHaveLength(5);
    items.forEach((i) => i.click());
    expect(store.toggle).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => expect(navigator.share).toHaveBeenCalled());
    await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    article.set({ ...base, favorite: true, later: true, read: true, link: '' });
    fixture.detectChanges();
    expect(root.querySelectorAll('.radial-item')).toHaveLength(3);
  });

  it('builds the overflow menu', async () => {
    const { root, fixture } = setup({ overflow: true });
    const more = root.querySelector<HTMLButtonElement>('[aria-label="Plus d\'actions"]')!;
    more.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('[role="menuitem"]')).toHaveLength(4);
    root.querySelector<HTMLElement>('.fixed.inset-0')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="menu"]')).toBeNull();

    more.click();
    fixture.detectChanges();
    const items = root.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items[0].click();
    fixture.detectChanges();
    expect(store.fetchFullText).toHaveBeenCalled();
    await vi.waitFor(() => expect(snackbar.show).toHaveBeenCalled());
    more.click();
    fixture.detectChanges();
    const link = root.querySelector<HTMLAnchorElement>('a[role="menuitem"]')!;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="menu"]')).toBeNull();
  });

  it('shows no overflow button when there is nothing to offer', () => {
    vi.stubGlobal('speechSynthesis', undefined);
    delete (globalThis as { speechSynthesis?: unknown }).speechSynthesis;
    delete (window as { speechSynthesis?: unknown }).speechSynthesis;
    article.set({ ...base, link: '' });
    const { root } = setup({ overflow: true });
    expect(root.querySelector('button')).toBeNull();
  });
});
