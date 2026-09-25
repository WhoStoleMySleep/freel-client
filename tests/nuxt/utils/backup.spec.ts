import { describe, expect, test } from 'vitest'
import type { BackupFile } from '~/types'

function validBackup(): BackupFile {
  return {
    app: 'freel',
    formatVersion: 2,
    exportedAt: '2026-01-01T00:00:00.000Z',
    settings: { ...{ themeMode: 'system', currency: 'RUB', defaultRate: 2500, hasOnboarded: true, invoiceSeq: 3, compactTaskForm: false, language: 'system' } },
    projects: [],
    tasks: [],
    timeEntries: [],
    invoices: [],
    invoiceItems: [],
  }
}

describe('parseBackup', () => {
  test('принимает корректный файл', async () => {
    const { parseBackup } = await import('~/utils/backup')
    expect(parseBackup(JSON.stringify(validBackup())).ok).toBe(true)
  })

  test('не-JSON отвергает с понятной причиной', async () => {
    const { parseBackup } = await import('~/utils/backup')
    const result = parseBackup('не json')
    expect(result).toMatchObject({ ok: false, error: 'notJson' })
  })

  test('чужой файл отвергает', async () => {
    const { parseBackup } = await import('~/utils/backup')
    const result = parseBackup(JSON.stringify({ ...validBackup(), app: 'other' }))
    expect(result).toMatchObject({ ok: false })
  })

  test('копию из будущей версии отвергает', async () => {
    const { BACKUP_FORMAT_VERSION, parseBackup } = await import('~/utils/backup')
    const result = parseBackup(JSON.stringify({ ...validBackup(), formatVersion: BACKUP_FORMAT_VERSION + 1 }))
    expect(result).toMatchObject({ ok: false, error: 'tooNew' })
  })

  test('копию из прошлой версии принимает', async () => {
    const { parseBackup } = await import('~/utils/backup')
    expect(parseBackup(JSON.stringify({ ...validBackup(), formatVersion: 1 })).ok).toBe(true)
  })

  test('без списка задач отвергает', async () => {
    const { parseBackup } = await import('~/utils/backup')
    const { tasks: _tasks, ...rest } = validBackup()
    expect(parseBackup(JSON.stringify(rest))).toMatchObject({ ok: false, error: 'incomplete' })
  })
})

describe('backupFileName', () => {
  test('складывает дату и время в имя файла', async () => {
    const { backupFileName } = await import('~/utils/backup')
    expect(backupFileName(new Date(2026, 0, 5, 9, 7))).toBe('freel-backup-2026-01-05-0907.json')
  })
})
