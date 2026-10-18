/**
 * Hues the design prototype cycles through. Every project gets one of them at
 * the same lightness and chroma, so a list of projects reads as one palette
 * however many of them there are.
 */
const HUES = [265, 155, 75, 300, 240, 160, 85, 320, 250, 145, 40, 20, 200, 60, 340, 280, 225]

/**
 * The hue is taken from the key rather than the project's position in the
 * list: a colour that changed when a project was archived would make the dots
 * on the dashboard meaningless.
 *
 * The key is the project id everywhere a project is at hand. An issued invoice
 * stores its lines by project name instead, so that is what its detail view
 * passes — a different colour for the same project there is a known limit.
 */
function hueOf(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) % 0x7fffffff
  }
  return HUES[hash % HUES.length]!
}

export function projectColor(key: string): string {
  return `oklch(0.74 0.13 ${hueOf(key)})`
}

/** The same colour at card-background strength, for the letter avatars. */
export function projectTint(key: string): string {
  return `oklch(0.74 0.13 ${hueOf(key)} / 0.16)`
}

/** First letter for a project avatar, with a bare URL reduced to its host. */
export function projectLetter(name: string): string {
  const trimmed = name.replace(/^https?:\/\//, '').trim()
  return (trimmed[0] ?? '?').toUpperCase()
}
