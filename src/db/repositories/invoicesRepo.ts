import { getDb } from '../client';
import { softDelete } from '../softDelete';
import { Invoice, InvoiceItem } from '../../domain/types';
import { InvoiceStatus } from '../../domain/status';
import { newId } from '../../utils/id';
import { nowIso } from '../../utils/date';
import { nextInvoiceNumber } from './settingsRepo';

interface InvoiceRow {
  id: string;
  number: string;
  project_name: string;
  day_key: string;
  status: InvoiceStatus;
  factual: number | null;
  total: number;
}

interface InvoiceItemRow {
  id: string;
  invoice_id: string;
  title: string;
  project_name: string;
  minutes: number;
  amount: number;
}

function mapItem(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    title: row.title,
    projectName: row.project_name,
    minutes: row.minutes,
    amount: row.amount,
  };
}

export async function listInvoices(): Promise<Invoice[]> {
  const db = await getDb();
  const invoiceRows = await db.select<InvoiceRow[]>(
    'SELECT * FROM invoices WHERE deleted_at IS NULL ORDER BY rowid DESC'
  );
  const itemRows = await db.select<InvoiceItemRow[]>(
    'SELECT * FROM invoice_items WHERE deleted_at IS NULL'
  );
  const itemsByInvoice = new Map<string, InvoiceItem[]>();
  for (const row of itemRows) {
    const list = itemsByInvoice.get(row.invoice_id) ?? [];
    list.push(mapItem(row));
    itemsByInvoice.set(row.invoice_id, list);
  }
  return invoiceRows.map((row) => ({
    id: row.id,
    number: row.number,
    projectName: row.project_name,
    dayKey: row.day_key,
    status: row.status,
    factual: row.factual,
    total: row.total,
    items: itemsByInvoice.get(row.id) ?? [],
  }));
}

export interface NewInvoiceInput {
  projectName: string;
  dayKey: string;
  items: { title: string; projectName: string; minutes: number; amount: number }[];
}

export async function createInvoice(input: NewInvoiceInput): Promise<Invoice> {
  const db = await getDb();
  const id = newId();
  const number = await nextInvoiceNumber();
  const total = input.items.reduce((a, i) => a + i.amount, 0);

  const now = nowIso();
  await db.execute(
    `INSERT INTO invoices (id, number, project_name, day_key, status, factual, total,
                           created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)`,
    [id, number, input.projectName, input.dayKey, 'awaiting', total, now, now]
  );
  const items: InvoiceItem[] = [];
  for (const item of input.items) {
    const itemId = newId();
    await db.execute(
      `INSERT INTO invoice_items (id, invoice_id, title, project_name, minutes, amount,
                                  created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [itemId, id, item.title, item.projectName, item.minutes, item.amount, now, now]
    );
    items.push({ id: itemId, invoiceId: id, ...item });
  }

  return { id, number, projectName: input.projectName, dayKey: input.dayKey, status: 'awaiting', factual: null, total, items };
}

/** Tombstones the invoice along with its line items. */
export async function deleteInvoice(id: string): Promise<void> {
  await softDelete('invoice', id);
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus, factual: number | null): Promise<void> {
  const db = await getDb();
  await db.execute('UPDATE invoices SET status = $1, factual = $2, updated_at = $3 WHERE id = $4', [
    status,
    factual,
    nowIso(),
    id,
  ]);
}
