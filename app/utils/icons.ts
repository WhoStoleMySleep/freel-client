import type { IconDef, IconName } from '~/types'

/**
 * The app's icon set, drawn on one 24×24 grid.
 *
 * Only what differs from the common stroke style is spelled out: a glyph that
 * carries no `size` or `strokeWidth` uses 16px at 2px.
 */
export const ICONS: Record<IconName, IconDef> = {
  'clock': {
    strokeWidth: 2.4,
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 9 },
      { tag: 'path', d: 'M12 7v5l3 1.7' },
    ],
  },
  'settings': {
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 3 },
      { tag: 'path', d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' },
    ],
  },
  'moon': {
    shapes: [{ tag: 'path', d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' }],
  },
  'sun': {
    shapes: [
      { tag: 'circle', cx: 12, cy: 12, r: 4.5 },
      { tag: 'path', d: 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7' },
    ],
  },
  'check': {
    strokeWidth: 3,
    shapes: [{ tag: 'path', d: 'M20 6L9 17l-5-5' }],
  },
  'chevron-left': {
    strokeWidth: 2.4,
    shapes: [{ tag: 'path', d: 'M15 18l-6-6 6-6' }],
  },
  'chevron-right': {
    strokeWidth: 2.4,
    shapes: [{ tag: 'path', d: 'M9 18l6-6-6-6' }],
  },
  'play': {
    size: 12,
    filled: true,
    shapes: [{ tag: 'path', d: 'M7 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 7 5.5z' }],
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
    strokeWidth: 2.2,
    shapes: [
      { tag: 'path', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
      { tag: 'path', d: 'M14 2v6h6M9 15h6M9 11h2' },
    ],
  },
  'link': {
    strokeWidth: 2.2,
    shapes: [
      { tag: 'path', d: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7' },
      { tag: 'path', d: 'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7' },
    ],
  },
  'tab-dash': {
    size: 22,
    shapes: [
      { tag: 'rect', x: 3, y: 3, width: 7, height: 9, rx: 1.5 },
      { tag: 'rect', x: 14, y: 3, width: 7, height: 5, rx: 1.5 },
      { tag: 'rect', x: 14, y: 12, width: 7, height: 9, rx: 1.5 },
      { tag: 'rect', x: 3, y: 16, width: 7, height: 5, rx: 1.5 },
    ],
  },
  'tab-projects': {
    size: 22,
    shapes: [{ tag: 'path', d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  },
  'tab-billing': {
    size: 22,
    shapes: [
      { tag: 'path', d: 'M3 3v18h18' },
      { tag: 'path', d: 'M7 14l3-4 3 3 5-7' },
    ],
  },
  'stop': {
    shapes: [{ tag: 'rect', x: 6.5, y: 6.5, width: 11, height: 11, rx: 2 }],
  },
}
