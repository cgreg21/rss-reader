import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

import { sanitizeHtml } from '../../rss/parsing/feed-parser';
import { ImageCache } from '../../rss/services/image-cache.service';
import { SettingsStore } from '../../rss/stores/settings.store';

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

/** Favicon of a site: its /favicon.ico, then Google's favicon service when that image cannot be loaded. */
@Directive({ selector: 'img[rssFavicon]', host: { '(error)': 'fallback()' } })
export class FaviconDirective {
  readonly site = input.required<string>({ alias: 'rssFavicon' });
  private readonly images = inject(ImageCache);
  private readonly img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
  private google = false;

  constructor() {
    effect(() => {
      this.google = false;
      let origin: string;
      try {
        origin = new URL(this.site()).origin;
      } catch {
        return;
      }
      void loadVia(this.images, this.img, `${origin}/favicon.ico`);
    });
  }

  protected fallback(): void {
    if (this.google) {
      this.img.remove();
      return;
    }
    this.google = true;
    let host: string;
    try {
      host = new URL(this.site()).hostname;
    } catch {
      return;
    }
    void loadVia(this.images, this.img, `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(host)}`);
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
