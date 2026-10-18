import type { IconDef, IconName } from '~/types'

/**
 * The app's icon set, drawn on one 24×24 grid.
 *
 * Only what differs from the common stroke style is spelled out: a glyph that
 * carries no `size` or `strokeWidth` uses 16px at 2px.
 */
export const ICONS: Record<IconName, IconDef> = {
  'clock': {
    strokeWidth: 2.2,
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 9 },
      { tag: 'path', d: 'M12 7v5l3 2' },
    ],
  },
  /* The prototype draws the gear as a circle with eight radial ticks, which
     is its sun with shorter rays — side by side in the header the two were
     indistinguishable, so the toothed gear stays. */
  'settings': {
    strokeWidth: 1.8,
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 3 },
      { tag: 'path', d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ],
  },
  'moon': {
    strokeWidth: 1.8,
    shapes: [{ tag: 'path', d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }],
  },
  'sun': {
    strokeWidth: 1.8,
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 4 },
      { tag: 'path', d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' },
    ],
  },
  'check': {
    strokeWidth: 2.2,
    shapes: [{ tag: 'path', d: 'M5 12l5 5L20 7' }],
  },
  'plus': {
    strokeWidth: 2.4,
    shapes: [{ tag: 'path', d: 'M12 5v14M5 12h14' }],
  },
  'chevron-left': {
    strokeWidth: 2.2,
    shapes: [{ tag: 'path', d: 'M15 6l-6 6 6 6' }],
  },
  'chevron-right': {
    strokeWidth: 2.2,
    shapes: [{ tag: 'path', d: 'M9 6l6 6-6 6' }],
  },
  'play': {
    size: 12,
    filled: true,
    shapes: [{ tag: 'path', d: 'M6 4l14 8-14 8z' }],
  },
  'pause': {
    size: 12,
    filled: true,
    shapes: [
      { tag: 'rect', x: 6, y: 5, width: 4, height: 14, rx: 1.3 },
      { tag: 'rect', x: 14, y: 5, width: 4, height: 14, rx: 1.3 },
    ],
  },
  'invoice': {
    shapes: [
      { tag: 'path', d: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z' },
      { tag: 'path', d: 'M14 3v6h6M8 13h8M8 17h5' },
    ],
  },
  'link': {
    shapes: [
      { tag: 'path', d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1' },
      { tag: 'path', d: 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
    ],
  },
  'copy': {
    shapes: [
      { tag: 'rect', x: 9, y: 9, width: 12, height: 12, rx: 2 },
      { tag: 'path', d: 'M5 15V5a2 2 0 0 1 2-2h10' },
    ],
  },
  'tab-dash': {
    size: 22,
    strokeWidth: 1.9,
    shapes: [
      { tag: 'rect', x: 3, y: 3, width: 7, height: 7, rx: 2 },
      { tag: 'rect', x: 14, y: 3, width: 7, height: 7, rx: 2 },
      { tag: 'rect', x: 3, y: 14, width: 7, height: 7, rx: 2 },
      { tag: 'rect', x: 14, y: 14, width: 7, height: 7, rx: 2 },
    ],
  },
  'tab-projects': {
    size: 22,
    strokeWidth: 1.9,
    shapes: [{ tag: 'path', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  },
  'tab-billing': {
    size: 22,
    strokeWidth: 1.9,
    shapes: [
      { tag: 'path', d: 'M3 3v18h18' },
      { tag: 'path', d: 'M7 15l4-5 3 3 5-6' },
    ],
  },
  'stop': {
    size: 12,
    filled: true,
    shapes: [{ tag: 'rect', x: 4, y: 4, width: 16, height: 16, rx: 3 }],
  },
}
