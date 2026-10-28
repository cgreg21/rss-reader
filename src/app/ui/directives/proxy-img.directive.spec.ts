import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ImageCache } from '../../rss/services/image-cache.service';
import { ProxyContentDirective, ProxyImgDirective } from './proxy-img.directive';

@Component({
  imports: [ProxyImgDirective, ProxyContentDirective],
  template: `<img [rssProxyImg]="url()" /><div id="c" [rssProxyContent]="html()"></div>`,
})
class HostComponent {
  url = signal('https://a.com/1.png');
  html = signal('<p>x</p><img src="https://a.com/2.png"><img srcset="https://a.com/3.png 2x"><img>');
}

describe('proxy image directives', () => {
  const observers: { cb: (e: { isIntersecting: boolean }[]) => void; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const images = { url: vi.fn(async (u: string) => `proxied:${u}`) };

  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', class {
      disconnect = vi.fn();
      constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
        observers.push({ cb, disconnect: this.disconnect });
      }
      observe(): void {}
    });
    TestBed.configureTestingModule({ providers: [{ provide: ImageCache, useValue: images }] });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the image once it becomes visible and re-observes on url change', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    observers[0].cb([{ isIntersecting: false }]);
    expect(images.url).not.toHaveBeenCalledWith('https://a.com/1.png');
    observers[0].cb([{ isIntersecting: true }]);
    await vi.waitFor(() => expect(img.src).toContain('proxied:https://a.com/1.png'));

    fixture.componentInstance.url.set('https://a.com/9.png');
    fixture.detectChanges();
    expect(observers).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalled();
    fixture.destroy();
    expect(observers[1].disconnect).toHaveBeenCalled();
  });

  it('renders sanitized content with images loaded through the cache', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('#c') as HTMLElement;
    expect(host.querySelector('p')?.textContent).toBe('x');
    const imgs = Array.from(host.querySelectorAll('img'));
    expect(imgs).toHaveLength(3);
    await vi.waitFor(() => expect(imgs[1].src).toContain('proxied:https://a.com/3.png'));
    expect(imgs[0].src).toContain('proxied:https://a.com/2.png');
    expect(imgs[2].getAttribute('src')).toBeNull();
  });
});
