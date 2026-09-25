import { describe, expect, test } from 'vitest'

/** Every key of a dictionary as a flat path, so the two can be compared. */
function paths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([key, value]) => paths(value, prefix ? `${prefix}.${key}` : key))
}

function valueAt(dictionary: object, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    dictionary,
  )
}

describe('словари локалей', () => {
  test('английский и русский описывают одни и те же ключи', async () => {
    const ru = (await import('~/locales/ru')).default
    const en = (await import('~/locales/en')).default
    expect(paths(en).sort()).toEqual(paths(ru).sort())
  })

  test('ни одна строка не осталась пустой', async () => {
    const en = (await import('~/locales/en')).default
    const missing = paths(en).filter(path => !String(valueAt(en, path) ?? '').trim())
    expect(missing).toEqual([])
  })
})
