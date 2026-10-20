/** Icons drawn with the Material Design Icons font bundled in `src/fonts` (same set as budget-pwa). */
const MDI_CODE_POINTS = {
  menu: 0xF035C, refresh: 0xF0450, plus: 0xF0415, 'cog-outline': 0xF08BB, rss: 0xF046B,
  'calendar-today': 0xF00F6, 'star-outline': 0xF04D2, star: 0xF04CE, 'check-all': 0xF012D,
  magnify: 0xF0349, 'arrow-left': 0xF004D, 'open-in-new': 0xF03CC, 'email-outline': 0xF01F0,
  'email-open-outline': 0xF05EF, 'trash-can-outline': 0xF0A7A, download: 0xF01DA, upload: 0xF0552,
} as const;

export type IconName = keyof typeof MDI_CODE_POINTS;

export function glyph(name: IconName): string {
  return String.fromCodePoint(MDI_CODE_POINTS[name]);
}

export const UI_ICONS = {
  menu: glyph('menu'),
  refresh: glyph('refresh'),
  add: glyph('plus'),
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
  download: glyph('download'),
  upload: glyph('upload'),
};
