import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'

function setHidden(hidden: boolean): void {
  Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function runningTimer() {
  const { useAppStore } = await import('~/stores/app')
  const { useTasksStore } = await import('~/stores/tasks')
  const { useTimerStore } = await import('~/stores/timer')
  await useAppStore().hydrate()
  const timer = useTimerStore()
  await timer.start(useTasksStore().items[0]!.id)
  return timer
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
  setHidden(false)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTimerTick', () => {
  test('без идущего таймера часы стоят', async () => {
    const { useAppStore } = await import('~/stores/app')
    await useAppStore().hydrate()
    const { useTimerTick } = await import('~/composables/useTimerTick')
    const scope = effectScope()
    const now = scope.run(() => useTimerTick())!
    const before = now.value

    vi.advanceTimersByTime(3000)

    expect(now.value).toBe(before)
    scope.stop()
  })

  test('при идущем таймере время шагает раз в секунду', async () => {
    await runningTimer()
    const { useTimerTick } = await import('~/composables/useTimerTick')
    const scope = effectScope()
    const now = scope.run(() => useTimerTick())!
    const before = now.value

    await vi.advanceTimersByTimeAsync(2000)

    expect(now.value).toBe(before + 2000)
    scope.stop()
  })

  test('спрятанное окно не перерисовывается впустую', async () => {
    await runningTimer()
    const { useTimerTick } = await import('~/composables/useTimerTick')
    const scope = effectScope()
    const now = scope.run(() => useTimerTick())!

    setHidden(true)
    const frozen = now.value
    await vi.advanceTimersByTimeAsync(5000)
    expect(now.value).toBe(frozen)

    setHidden(false)
    expect(now.value).toBe(frozen + 5000)
    scope.stop()
  })

  test('пауза останавливает часы, продолжение запускает снова', async () => {
    const timer = await runningTimer()
    const { useTimerTick } = await import('~/composables/useTimerTick')
    const scope = effectScope()
    const now = scope.run(() => useTimerTick())!

    await timer.pause()
    const frozen = now.value
    await vi.advanceTimersByTimeAsync(3000)
    expect(now.value).toBe(frozen)

    await timer.resume()
    await vi.advanceTimersByTimeAsync(1000)
    expect(now.value).toBe(frozen + 4000)
    scope.stop()
  })

  test('закрытая область видимости таймеров не оставляет', async () => {
    await runningTimer()
    const { useTimerTick } = await import('~/composables/useTimerTick')
    const scope = effectScope()
    scope.run(() => useTimerTick())

    scope.stop()

    expect(vi.getTimerCount()).toBe(0)
  })
})
