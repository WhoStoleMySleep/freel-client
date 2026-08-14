import { newId } from '../utils/id';
import { Invoice, InvoiceItem, Project, Task } from '../domain/types';

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysAgoDayKey(days: number): string {
  return daysAgoIso(days).slice(0, 10);
}

// A self-contained fixture dataset used only for the Settings "demo data"
// preview toggle. Dates are relative to "now" so the preview never looks
// stale. This never touches SQLite — the store swaps it in/out of the
// in-memory state only, so real user data is untouched underneath.
export function buildDemoData(): { projects: Project[]; tasks: Task[]; invoices: Invoice[] } {
  const now = new Date().toISOString();
  const pAcme = newId();
  const pFin = newId();
  const pOld = newId();

  const projects: Project[] = [
    { id: pAcme, name: 'Acme Store', description: 'Интернет-магазин, e-commerce', archived: false, createdAt: daysAgoIso(90), updatedAt: daysAgoIso(90) },
    { id: pFin, name: 'FinTech Dashboard', description: 'Аналитика для банка', archived: false, createdAt: daysAgoIso(60), updatedAt: daysAgoIso(60) },
    { id: pOld, name: 'Старый лендинг', description: 'Промо-сайт 2024', archived: true, createdAt: daysAgoIso(200), updatedAt: daysAgoIso(150) },
  ];

  const tasks: Task[] = [
    { id: newId(), projectId: pAcme, title: 'Оплата картой в чекауте', description: 'Интеграция эквайринга', link: 'https://tracker/AC-201', rateType: 'hourly', rate: 2500, minutes: 320, status: 'waiting_payment', createdAt: daysAgoIso(16), updatedAt: daysAgoIso(1) },
    { id: newId(), projectId: pAcme, title: 'Багфикс корзины', description: 'Не пересчитывается сумма', link: 'https://tracker/AC-214', rateType: 'hourly', rate: 2500, minutes: 95, status: 'in_work', createdAt: now, updatedAt: now },
    { id: newId(), projectId: pFin, title: 'Интеграция CDEK', description: 'Расчёт доставки', link: 'https://tracker/FT-88', rateType: 'fixed', rate: 45000, minutes: 610, status: 'review_code', createdAt: daysAgoIso(28), updatedAt: daysAgoIso(20) },
    { id: newId(), projectId: pFin, title: 'Рефактор авторизации', description: 'OAuth + 2FA', link: 'https://tracker/FT-90', rateType: 'hourly', rate: 3000, minutes: 180, status: 'review_managers', createdAt: daysAgoIso(8), updatedAt: daysAgoIso(2) },
    { id: newId(), projectId: pFin, title: 'Экспорт отчётов', description: 'PDF/XLSX выгрузка', link: 'https://tracker/FT-95', rateType: 'fixed', rate: 30000, minutes: 240, status: 'waiting_upload', createdAt: daysAgoIso(21), updatedAt: daysAgoIso(15) },
    { id: newId(), projectId: pAcme, title: 'Правки по дизайну', description: 'Ревизия макетов', link: 'https://tracker/AC-220', rateType: 'hourly', rate: 2200, minutes: 60, status: 'paused', createdAt: daysAgoIso(6), updatedAt: daysAgoIso(3) },
    { id: newId(), projectId: pFin, title: 'Настроить CI/CD', description: 'GitHub Actions', link: 'https://tracker/FT-99', rateType: 'hourly', rate: 3200, minutes: 0, status: 'next', createdAt: now, updatedAt: now },
    { id: newId(), projectId: pAcme, title: 'Push-уведомления', description: 'FCM интеграция', link: 'https://tracker/AC-225', rateType: 'fixed', rate: 18000, minutes: 140, status: 'waiting_payment', createdAt: daysAgoIso(12), updatedAt: daysAgoIso(9) },
    { id: newId(), projectId: pOld, title: 'Вёрстка промо-страницы', description: 'Готово, сдано', link: 'https://tracker/OL-12', rateType: 'fixed', rate: 25000, minutes: 500, status: 'done', createdAt: daysAgoIso(57), updatedAt: daysAgoIso(50) },
  ];

  // The first invoice deliberately spans two projects so the grouped invoice
  // layout has something to group.
  const inv2Id = newId();
  const inv2Items: InvoiceItem[] = [
    { id: newId(), invoiceId: inv2Id, title: 'Лендинг акции', projectName: 'Acme Store', minutes: 380, amount: 14200 },
    { id: newId(), invoiceId: inv2Id, title: 'A/B тесты', projectName: 'Acme Store', minutes: 180, amount: 6600 },
    { id: newId(), invoiceId: inv2Id, title: 'Правки виджета', projectName: 'FinTech Dashboard', minutes: 120, amount: 6000 },
  ];
  const inv1Id = newId();
  const inv1Items: InvoiceItem[] = [
    { id: newId(), invoiceId: inv1Id, title: 'Онбординг', projectName: 'FinTech Dashboard', minutes: 660, amount: 33000 },
    { id: newId(), invoiceId: inv1Id, title: 'Мелкие правки', projectName: 'FinTech Dashboard', minutes: 150, amount: 7500 },
  ];

  const invoices: Invoice[] = [
    { id: inv2Id, number: '#00122', projectName: 'Разные проекты', dayKey: daysAgoDayKey(14), status: 'sent', factual: null, total: 26800, items: inv2Items },
    { id: inv1Id, number: '#00121', projectName: 'FinTech Dashboard', dayKey: daysAgoDayKey(24), status: 'paid', factual: 38500, total: 40500, items: inv1Items },
  ];

  return { projects, tasks, invoices };
}

export function demoTodayMinutes(tasks: Task[]): number {
  const todayKey = new Date().toISOString().slice(0, 10);
  return tasks.filter((t) => t.createdAt.slice(0, 10) === todayKey).reduce((a, t) => a + t.minutes, 0);
}
