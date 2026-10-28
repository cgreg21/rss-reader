import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

import { sanitizeHtml } from '../../rss/feed-parser';
import { ImageCache } from '../../rss/services/image-cache.service';
import { SettingsStore } from '../../rss/settings.store';

const loadVia = async (images: ImageCache, img: HTMLImageElement, url: string): Promise<void> => {
  img.src = await images.url(url);
};

/** Loads an image through the CORS proxy (when enabled) once it is about to scroll into view. */
@Directive({ selector: 'img[rssProxyImg]' })
export class ProxyImgDirective implements OnDestroy {
  readonly url = input.required<string>({ alias: 'rssProxyImg' });
  private readonly images = inject(ImageCache);
  private readonly settings = inject(SettingsStore);
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const url = this.url();
      this.settings.activeProxy();
      this.observer?.disconnect();
      this.observer = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        this.observer?.disconnect();
        void loadVia(this.images, this.img, url);
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
  private readonly images = inject(ImageCache);
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
      for (const [img, url] of images) void loadVia(this.images, img, url);
    });
  }
}
