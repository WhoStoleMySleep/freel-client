import { describe, expect, test, vi } from 'vitest'
import { effectScope } from 'vue'

describe('useAsyncListener', () => {
  test('снимает подписку вместе с областью видимости', async () => {
    const { useAsyncListener } = await import('~/composables/useAsyncListener')
    const unsubscribe = vi.fn()
    const scope = effectScope()

    scope.run(() => useAsyncListener(async () => unsubscribe))
    await Promise.resolve()
    scope.stop()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  test('подписка, опоздавшая к закрытию, снимается задним числом', async () => {
    const { useAsyncListener } = await import('~/composables/useAsyncListener')
    const unsubscribe = vi.fn()
    let resolve: (fn: () => void) => void = () => {}
    const scope = effectScope()

    scope.run(() => useAsyncListener(() => new Promise<() => void>((r) => { resolve = r })))
    scope.stop()
    resolve(unsubscribe)
    await Promise.resolve()

    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  test('сорвавшаяся подписка не роняет область видимости', async () => {
    const { useAsyncListener } = await import('~/composables/useAsyncListener')
    const scope = effectScope()

    scope.run(() => useAsyncListener(() => Promise.reject(new Error('нет окна'))))
    await Promise.resolve()

    expect(() => scope.stop()).not.toThrow()
  })
})
