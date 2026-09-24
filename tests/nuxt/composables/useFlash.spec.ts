import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useFlash', () => {
  test('начинает с покоя и возвращается к нему сам', async () => {
    const { useFlash } = await import('~/composables/useFlash')
    const { value, flash } = useFlash('', 1000)

    expect(value.value).toBe('')
    flash('Скопировано')
    expect(value.value).toBe('Скопировано')

    vi.advanceTimersByTime(1000)
    expect(value.value).toBe('')
  })

  test('вторая вспышка заменяет первую, а не встаёт в очередь', async () => {
    const { useFlash } = await import('~/composables/useFlash')
    const { value, flash } = useFlash('', 1000)

    flash('Первое')
    vi.advanceTimersByTime(900)
    flash('Второе')
    vi.advanceTimersByTime(900)

    expect(value.value).toBe('Второе')
    vi.advanceTimersByTime(100)
    expect(value.value).toBe('')
  })

  test('вспышка значением покоя — просто сброс', async () => {
    const { useFlash } = await import('~/composables/useFlash')
    const { value, flash } = useFlash('', 1000)

    flash('Ошибка')
    flash('')

    expect(value.value).toBe('')
    expect(vi.getTimerCount()).toBe(0)
  })

  test('закрытая область видимости не дёргает значение', async () => {
    const { useFlash } = await import('~/composables/useFlash')
    const scope = effectScope()
    const flash = scope.run(() => useFlash('', 1000))!

    flash.flash('Скопировано')
    scope.stop()
    vi.advanceTimersByTime(1000)

    expect(vi.getTimerCount()).toBe(0)
    expect(flash.value.value).toBe('Скопировано')
  })
})
