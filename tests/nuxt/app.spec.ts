import { describe, expect, test, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'

const { label } = vi.hoisted(() => ({ label: { value: 'main' } }))

mockNuxtImport('windowLabel', () => () => label.value)

async function mountApp() {
  const App = (await import('~/app.vue')).default
  return mountSuspended(App, {
    global: {
      stubs: {
        MainWindow: { template: '<div class="stub-main" />' },
        PanelWindow: { template: '<div class="stub-panel" />' },
      },
    },
  })
}

describe('выбор окна по метке', () => {
  test('в главном окне рендерится главный экран', async () => {
    label.value = 'main'
    const app = await mountApp()
    expect(app.find('.stub-main').exists()).toBe(true)
    expect(app.find('.stub-panel').exists()).toBe(false)
    expect(document.body.className).not.toContain('panel-window')
  })

  test('в окне панели рендерится панель', async () => {
    label.value = 'panel'
    const app = await mountApp()
    expect(app.find('.stub-panel').exists()).toBe(true)
    expect(app.find('.stub-main').exists()).toBe(false)
  })

  test('окно панели помечает body — иначе фон закрасит прозрачное окно', async () => {
    label.value = 'panel'
    await mountApp()
    expect(document.body.className).toContain('panel-window')
  })
})
