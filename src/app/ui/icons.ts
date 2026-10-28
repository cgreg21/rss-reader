/** Icons drawn with the Material Design Icons font bundled in `src/fonts` (same set as budget-pwa). */
const MDI_CODE_POINTS = {
  menu: 0xF035C, check: 0xF012C, info: 0xF02FC, refresh: 0xF0450, plus: 0xF0415, 'cog-outline': 0xF08BB, rss: 0xF046B,
  'calendar-today': 0xF00F6, 'star-outline': 0xF04D2, star: 0xF04CE, 'check-all': 0xF012D,
  magnify: 0xF0349, 'arrow-left': 0xF004D, 'open-in-new': 0xF03CC, 'email-outline': 0xF01F0,
  'email-open-outline': 0xF05EF, 'trash-can-outline': 0xF0A7A, close: 0xF0156, 'view-list': 0xF0572, 'view-agenda': 0xF056A, 'cards-outline': 0xF0639,   download: 0xF01DA, upload: 0xF0552, bookmark: 0xF00C0, 'bookmark-outline': 0xF00C3, 'file-document-outline': 0xF0219, 'volume-high': 0xF057E,   stop: 0xF04DB, 'book-open-page-variant': 0xF05DA, 'dots-vertical': 0xF01D9, 'dots-grid': 0xF15FC, 'share-variant': 0xF0497, 'link-variant': 0xF0339,
  play: 0xF040A, headphones: 0xF02CB, video: 0xF0567, 'text-box-outline': 0xF09ED, pause: 0xF03E4, 'rewind-15': 0xF1946, 'fast-forward-30': 0xF0D06,
} as const;

export type IconName = keyof typeof MDI_CODE_POINTS;

export function glyph(name: IconName): string {
  return String.fromCodePoint(MDI_CODE_POINTS[name]);
}

export const UI_ICONS = {
  mediaText: glyph('text-box-outline'),
  mediaAudio: glyph('headphones'),
  mediaVideo: glyph('video'),
  menu: glyph('menu'),
  grid: glyph('dots-grid'),
  refresh: glyph('refresh'),
  add: glyph('plus'),
  check: glyph('check'),
  info: glyph('info'),
  settings: glyph('cog-outline'),
  all: glyph('rss'),
  today: glyph('calendar-today'),
  favorite: glyph('star-outline'),
  favoriteOn: glyph('star'),
  markAllRead: glyph('check-all'),
  search: glyph('magnify'),
  back: glyph('arrow-left'),
  external: glyph('open-in-new'),
  unread: glyph('email-outline'),
  read: glyph('email-open-outline'),
  trash: glyph('trash-can-outline'),
  close: glyph('close'),
  layoutList: glyph('view-list'),
  layoutDetail: glyph('view-agenda'),
  layoutCard: glyph('cards-outline'),
  download: glyph('download'),
  upload: glyph('upload'),
  later: glyph('bookmark-outline'),
  laterOn: glyph('bookmark'),
  fullText: glyph('file-document-outline'),
  speak: glyph('volume-high'),
  stop: glyph('stop'),
  more: glyph('dots-vertical'),
  share: glyph('share-variant'),
  copyLink: glyph('link-variant'),
  reader: glyph('book-open-page-variant'),
};

export const mediaIcon = (media?: { kind: string }): string =>
  media?.kind === 'audio' ? UI_ICONS.mediaAudio : media ? UI_ICONS.mediaVideo : UI_ICONS.mediaText;
