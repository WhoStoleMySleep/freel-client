import { describe, expect, test } from 'vitest'

describe('projectColor', () => {
  test('один и тот же ключ всегда даёт один цвет', async () => {
    const { projectColor } = await import('~/utils/projectColor')

    expect(projectColor('p-1')).toBe(projectColor('p-1'))
  })

  test('разные ключи разводятся по разным оттенкам', async () => {
    const { projectColor } = await import('~/utils/projectColor')

    const colors = new Set(['a', 'b', 'c', 'd', 'e'].map(projectColor))

    expect(colors.size).toBeGreaterThan(1)
  })

  test('пустой ключ не роняет функцию', async () => {
    const { projectColor } = await import('~/utils/projectColor')

    expect(projectColor('')).toMatch(/^oklch\(/)
  })
})

describe('projectTint', () => {
  test('отличается от основного цвета только прозрачностью', async () => {
    const { projectColor, projectTint } = await import('~/utils/projectColor')

    expect(projectTint('p-1')).toBe(projectColor('p-1').replace(')', ' / 0.16)'))
  })
})

describe('projectLetter', () => {
  test('берёт первую букву в верхнем регистре', async () => {
    const { projectLetter } = await import('~/utils/projectColor')

    expect(projectLetter('плитка-54.рф')).toBe('П')
  })

  test('у адреса схема отбрасывается', async () => {
    const { projectLetter } = await import('~/utils/projectColor')

    expect(projectLetter('https://auto-rs42.ru/')).toBe('A')
  })

  test('пустое имя заменяется вопросом', async () => {
    const { projectLetter } = await import('~/utils/projectColor')

    expect(projectLetter('   ')).toBe('?')
  })
})
