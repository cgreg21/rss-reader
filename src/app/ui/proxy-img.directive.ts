import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

import { sanitizeHtml } from '../rss/feed-parser';
import { RssStore } from '../rss/rss.store';

const loadVia = async (store: RssStore, img: HTMLImageElement, url: string): Promise<void> => {
  img.src = await store.imageUrl(url);
};

/** Loads an image through the CORS proxy (when enabled) once it is about to scroll into view. */
@Directive({ selector: 'img[rssProxyImg]' })
export class ProxyImgDirective implements OnDestroy {
  readonly url = input.required<string>({ alias: 'rssProxyImg' });
  private readonly store = inject(RssStore);
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const url = this.url();
      this.store.proxyEnabled();
      this.store.proxy();
      this.observer?.disconnect();
      this.observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.observer?.disconnect();
        void loadVia(this.store, this.img, url);
      }, { rootMargin: '200px' });
      this.observer.observe(this.img);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

/** Renders sanitized article HTML, loading its images through the CORS proxy (when enabled). */
@Directive({ selector: '[rssProxyContent]' })
export class ProxyContentDirective {
  readonly html = input.required<string>({ alias: 'rssProxyContent' });
  private readonly store = inject(RssStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    effect(() => {
      const doc = new DOMParser().parseFromString(sanitizeHtml(this.html()), 'text/html');
      const images: [HTMLImageElement, string][] = [];
      for (const img of Array.from(doc.body.querySelectorAll('img'))) {
        const url = img.getAttribute('src') || img.getAttribute('srcset')?.trim().split(/\s+/)[0];
        img.removeAttribute('src');
        img.removeAttribute('srcset');
        if (url) images.push([img, url]);
      }
      this.host.replaceChildren(...Array.from(doc.body.childNodes).map((n) => document.adoptNode(n)));
      for (const [img, url] of images) void loadVia(this.store, img, url);
    });
  }
}
