const BLOCKED = 'script,iframe,object,embed,style,link,form,meta';

/** Removes active content and event handlers from remote HTML before it is stored and displayed. */
export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(BLOCKED).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const value = attr.value.trim().toLowerCase();
      if (attr.name.startsWith('on') || ((attr.name === 'href' || attr.name === 'src') && value.startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
    if (el.tagName === 'IMG') el.setAttribute('loading', 'lazy');
  });
  return doc.body.innerHTML;
}

export function toText(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim();
}

const JUNK_SELECTORS = [
  'nav,header,footer,aside,form,noscript,script,style,template,button,dialog,svg,canvas,object,embed',
  '[role=navigation],[role=banner],[role=contentinfo],[role=complementary],[role=search],[aria-hidden=true],[hidden]',
].join(',');
const JUNK_TOKENS = /(^|[\s_-])(menu|navbar|nav|sidebar|widget|share|sharing|social|related|comments?|breadcrumbs?|cookie|consent|newsletter|subscribe|promo|advert|ads?|sponsor|popup|modal|toolbar|pagination|tags|author-box|byline-extra)($|[\s_-])/i;
const CONTENT_SELECTORS = ['[itemprop=articleBody]', '.entry-content', '.post-content', '.article-content', '.article-body', '.post-body', '.story-body', '[role=main]', 'article', 'main'];

const textLength = (el: Element): number => el.textContent?.trim().length ?? 0;

/** Extracts the main readable block of a full web page, without menus, footers, share bars and other page chrome. */
export function extractReadable(html: string, baseUrl: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(JUNK_SELECTORS).forEach((el) => el.remove());
  let best: Element | null = null;
  for (const selector of CONTENT_SELECTORS) {
    const found = Array.from(doc.querySelectorAll(selector)).sort((a, b) => textLength(b) - textLength(a))[0];
    if (found && textLength(found) >= 200) { best = found; break; }
    best ??= found ?? null;
  }
  if (!best || textLength(best) < 200) {
    let score = 0;
    doc.body?.querySelectorAll('div,section').forEach((el) => {
      const own = Array.from(el.querySelectorAll('p')).reduce((n, p) => n + (p.textContent?.length ?? 0), 0);
      if (own > score) { score = own; best = el; }
    });
  }
  const root = (best ?? doc.body) as Element | null;
  if (!root) return '';
  root.querySelectorAll('*').forEach((el) => {
    if (!el.isConnected || el === root) return;
    const label = `${el.getAttribute('class') ?? ''} ${el.id}`;
    if (JUNK_TOKENS.test(label)) { el.remove(); return; }
    // Link-heavy blocks (related posts, tag clouds, inline menus) carry little article text.
    if (/^(ul|ol|div|section|p)$/i.test(el.tagName)) {
      const text = textLength(el);
      const links = Array.from(el.querySelectorAll('a')).reduce((n, a) => n + textLength(a), 0);
      if (text > 0 && links / text > 0.8 && text < 600 && el.querySelectorAll('a').length >= 3) el.remove();
    }
  });

  root.querySelectorAll('[src],[href]').forEach((el) => {
    for (const name of ['src', 'href']) {
      const value = el.getAttribute(name);
      if (!value) continue;
      try { el.setAttribute(name, new URL(value, baseUrl).href); } catch { /* keep as is */ }
    }
  });
  return sanitizeHtml(root.innerHTML);
}

export const looksLikeHtml = (body: string): boolean => /^\s*(<!doctype\s+html|<html[\s>])/i.test(body);
