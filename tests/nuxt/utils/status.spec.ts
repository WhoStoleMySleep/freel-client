import { describe, expect, test } from 'vitest'

describe('stepStatus', () => {
  test('двигает статус на шаг вперёд', async () => {
    const { STEP_ORDER, stepStatus } = await import('~/utils/status')
    expect(stepStatus(STEP_ORDER[0]!, 1)).toBe(STEP_ORDER[1])
  })

  test('на первом статусе назад не уходит', async () => {
    const { STEP_ORDER, stepStatus } = await import('~/utils/status')
    expect(stepStatus(STEP_ORDER[0]!, -1)).toBe(STEP_ORDER[0])
  })

  test('на последнем статусе вперёд не уходит', async () => {
    const { STEP_ORDER, stepStatus } = await import('~/utils/status')
    const last = STEP_ORDER.at(-1)!
    expect(stepStatus(last, 1)).toBe(last)
  })

  test('статус вне конвейера считает началом', async () => {
    const { STEP_ORDER, stepStatus } = await import('~/utils/status')
    expect(stepStatus('done', 1)).toBe(STEP_ORDER[1])
  })
})

describe('наборы статусов', () => {
  test('выставленная в счёт работа остаётся в заработанном, но не в долге', async () => {
    const { EARNED_STATUSES, COUNTED_STATUSES } = await import('~/utils/status')
    expect(EARNED_STATUSES).toContain('done')
    expect(COUNTED_STATUSES).not.toContain('done')
  })

  test('у каждого статуса есть подпись', async () => {
    const { STATUS, STEP_ORDER } = await import('~/utils/status')
    for (const status of STEP_ORDER) expect(STATUS[status].label.length).toBeGreaterThan(0)
  })
})
