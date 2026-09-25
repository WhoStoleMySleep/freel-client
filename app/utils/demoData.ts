import type { Invoice, InvoiceItem, Project, Task } from '~/types'

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function daysAgoDayKey(days: number): string {
  return daysAgoIso(days).slice(0, 10)
}

export interface DemoData {
  projects: Project[]
  tasks: Task[]
  invoices: Invoice[]
}

function demoProjects(): Project[] {
  return [
    { id: newId(), name: translate('demo.acme'), description: translate('demo.acmeDescription'), archived: false, createdAt: daysAgoIso(90), updatedAt: daysAgoIso(90) },
    { id: newId(), name: translate('demo.fin'), description: translate('demo.finDescription'), archived: false, createdAt: daysAgoIso(60), updatedAt: daysAgoIso(60) },
    { id: newId(), name: translate('demo.old'), description: translate('demo.oldDescription'), archived: true, createdAt: daysAgoIso(200), updatedAt: daysAgoIso(150) },
  ]
}

function demoTasks(acme: string, fin: string, old: string): Task[] {
  const now = new Date().toISOString()
  return [
    { id: newId(), projectId: acme, title: translate('demo.task1'), description: translate('demo.task1Description'), link: 'https://tracker/AC-201', rateType: 'hourly', rate: 2500, minutes: 320, status: 'waiting_payment', createdAt: daysAgoIso(16), updatedAt: daysAgoIso(1) },
    { id: newId(), projectId: acme, title: translate('demo.task2'), description: translate('demo.task2Description'), link: 'https://tracker/AC-214', rateType: 'hourly', rate: 2500, minutes: 95, status: 'in_work', createdAt: now, updatedAt: now },
    { id: newId(), projectId: fin, title: translate('demo.task3'), description: translate('demo.task3Description'), link: 'https://tracker/FT-88', rateType: 'fixed', rate: 45000, minutes: 610, status: 'review_code', createdAt: daysAgoIso(28), updatedAt: daysAgoIso(20) },
    { id: newId(), projectId: fin, title: translate('demo.task4'), description: 'OAuth + 2FA', link: 'https://tracker/FT-90', rateType: 'hourly', rate: 3000, minutes: 180, status: 'review_managers', createdAt: daysAgoIso(8), updatedAt: daysAgoIso(2) },
    { id: newId(), projectId: fin, title: translate('demo.task5'), description: translate('demo.task5Description'), link: 'https://tracker/FT-95', rateType: 'fixed', rate: 30000, minutes: 240, status: 'waiting_upload', createdAt: daysAgoIso(21), updatedAt: daysAgoIso(15) },
    { id: newId(), projectId: acme, title: translate('demo.task6'), description: translate('demo.task6Description'), link: 'https://tracker/AC-220', rateType: 'hourly', rate: 2200, minutes: 60, status: 'paused', createdAt: daysAgoIso(6), updatedAt: daysAgoIso(3) },
    { id: newId(), projectId: fin, title: translate('demo.task7'), description: 'GitHub Actions', link: 'https://tracker/FT-99', rateType: 'hourly', rate: 3200, minutes: 0, status: 'next', createdAt: now, updatedAt: now },
    { id: newId(), projectId: acme, title: translate('demo.task8'), description: translate('demo.task8Description'), link: 'https://tracker/AC-225', rateType: 'fixed', rate: 18000, minutes: 140, status: 'waiting_payment', createdAt: daysAgoIso(12), updatedAt: daysAgoIso(9) },
    { id: newId(), projectId: old, title: translate('demo.task9'), description: translate('demo.task9Description'), link: 'https://tracker/OL-12', rateType: 'fixed', rate: 25000, minutes: 500, status: 'done', createdAt: daysAgoIso(57), updatedAt: daysAgoIso(50) },
  ]
}

function demoInvoices(): Invoice[] {
  // The first invoice deliberately spans two projects so the grouped invoice
  // layout has something to group.
  const mixedId = newId()
  const mixedItems: InvoiceItem[] = [
    { id: newId(), invoiceId: mixedId, title: translate('demo.item1'), projectName: translate('demo.acme'), minutes: 380, amount: 14200 },
    { id: newId(), invoiceId: mixedId, title: translate('demo.item2'), projectName: translate('demo.acme'), minutes: 180, amount: 6600 },
    { id: newId(), invoiceId: mixedId, title: translate('demo.item3'), projectName: translate('demo.fin'), minutes: 120, amount: 6000 },
  ]
  const finId = newId()
  const finItems: InvoiceItem[] = [
    { id: newId(), invoiceId: finId, title: translate('demo.item4'), projectName: translate('demo.fin'), minutes: 660, amount: 33000 },
    { id: newId(), invoiceId: finId, title: translate('demo.item5'), projectName: translate('demo.fin'), minutes: 150, amount: 7500 },
  ]
  return [
    { id: mixedId, number: '#00122', projectName: translate('invoice.mixedProjects'), dayKey: daysAgoDayKey(14), status: 'sent', factual: null, total: 26800, items: mixedItems },
    { id: finId, number: '#00121', projectName: translate('demo.fin'), dayKey: daysAgoDayKey(24), status: 'paid', factual: 38500, total: 40500, items: finItems },
  ]
}

/**
 * A self-contained fixture dataset used only for the Settings "demo data"
 * preview toggle. Dates are relative to "now" so the preview never looks
 * stale. This never touches SQLite — the whole data source is swapped out, so
 * real user data stays on disk untouched underneath.
 */
export function buildDemoData(): DemoData {
  const projects = demoProjects()
  const [acme, fin, old] = projects
  return {
    projects,
    tasks: demoTasks(acme!.id, fin!.id, old!.id),
    invoices: demoInvoices(),
  }
}

/** How many of the fixture's minutes fall on today. */
export function demoTodayMinutes(tasks: Task[]): number {
  const key = todayKey()
  return tasks.filter(t => t.createdAt.slice(0, 10) === key).reduce((a, t) => a + t.minutes, 0)
}
