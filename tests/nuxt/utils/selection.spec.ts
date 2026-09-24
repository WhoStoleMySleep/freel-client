import { describe, expect, test } from 'vitest'

describe('markStateOf', () => {
  test('пустая группа считается невыбранной', async () => {
    const { markStateOf } = await import('~/utils/selection')
    expect(markStateOf(0, 0)).toBe('none')
  })

  test('часть выбранного даёт промежуточное состояние', async () => {
    const { markStateOf } = await import('~/utils/selection')
    expect(markStateOf(1, 3)).toBe('some')
  })

  test('выбрано всё — только когда счётчики сошлись', async () => {
    const { markStateOf } = await import('~/utils/selection')
    expect(markStateOf(3, 3)).toBe('all')
    expect(markStateOf(2, 3)).toBe('some')
  })
})
