import { useEffect, useState } from 'react';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { useFlash } from '../hooks/useFlash';
import { BottomSheet, ModalHead } from '../components/BottomSheet';
import { Chip, Field } from '../components/Field';
import { IconClock } from '../components/icons';
import { useAppStore } from '../store/useAppStore';
import { INVOICE_STATUS, InvoiceStatus } from '../domain/status';
import { formatMinutes } from '../domain/time';
import { formatMoney } from '../domain/money';
import { invoiceToText } from '../domain/invoiceText';
import { shortDate } from '../utils/date';
import { InvoiceItem } from '../domain/types';

const STATUS_OPTIONS = Object.keys(INVOICE_STATUS) as InvoiceStatus[];

export function InvoiceDetailModal({ open, invoiceId, onClose }: { open: boolean; invoiceId: string | null; onClose: () => void }) {
  const invoices = useAppStore((s) => s.invoices);
  const currency = useAppStore((s) => s.settings.currency);
  const setInvoiceStatus = useAppStore((s) => s.setInvoiceStatus);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);

  const invoice = invoiceId ? invoices.find((v) => v.id === invoiceId) ?? null : null;
  const [status, setStatus] = useState<InvoiceStatus>('awaiting');
  const [factualStr, setFactualStr] = useState('');
  const [copied, flashCopied] = useFlash(false, 2000);

  useEffect(() => {
    if (open && invoice) {
      setStatus(invoice.status);
      setFactualStr(invoice.factual != null ? String(invoice.factual) : String(invoice.total));
      flashCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoiceId]);

  if (!invoice) return <BottomSheet open={open} onClose={onClose} children={<div />} />;

  const groups: { name: string; subtotal: number; items: InvoiceItem[] }[] = [];
  for (const item of invoice.items) {
    const name = item.projectName || 'Без проекта';
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, subtotal: 0, items: [] };
      groups.push(g);
    }
    g.items.push(item);
    g.subtotal += item.amount;
  }

  const save = () => {
    const factual = status === 'paid' ? parseFloat(factualStr) || invoice.total : null;
    setInvoiceStatus(invoice.id, status, factual);
    onClose();
  };

  const copyAsText = async () => {
    const text = invoiceToText(invoice);
    try {
      await writeText(text);
    } catch {
      await navigator.clipboard?.writeText(text);
    }
    flashCopied(true);
  };

  const confirmDelete = () => {
    if (confirm('Удалить счёт? Он будет удалён безвозвратно. Задачи в нём останутся со статусом «Готово».')) {
      deleteInvoice(invoice.id);
      onClose();
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="sheet-body">
        <ModalHead title={`Счёт ${invoice.number}`} onClose={onClose} />
        <p className="modal-hint" style={{ marginTop: -10 }}>
          {invoice.projectName} · {shortDate(invoice.dayKey)}
        </p>

        <div className="list" style={{ gap: 12 }}>
          {groups.map((g) => (
            <div className="inv-group" key={g.name}>
              <div className="inv-group-head">
                <span className="inv-group-name">{g.name}</span>
                <span className="inv-group-subtotal num">{formatMoney(g.subtotal, currency)}</span>
              </div>
              {g.items.map((item) => (
                <div className="inv-item" key={item.id}>
                  <div style={{ flex: 1 }}>
                    <div className="inv-item-title">{item.title}</div>
                    <div className="inv-item-hours">
                      <IconClock size={10} /> {formatMinutes(item.minutes)}
                    </div>
                  </div>
                  <div className="inv-item-amount num">{formatMoney(item.amount, currency)}</div>
                </div>
              ))}
            </div>
          ))}
          <div className="inv-total">
            <span className="inv-total-label">Итого по счёту</span>
            <span className="inv-total-value num">{formatMoney(invoice.total, currency)}</span>
          </div>
        </div>

        <div className="field-label" style={{ marginTop: 18 }}>
          Статус счёта
        </div>
        <div className="chips" style={{ gap: 7 }}>
          {STATUS_OPTIONS.map((k) => (
            <Chip key={k} label={INVOICE_STATUS[k].label} active={status === k} onClick={() => setStatus(k)} grow small />
          ))}
        </div>

        {status === 'paid' ? (
          <div style={{ marginTop: 14 }}>
            <Field label="Фактически получено" value={factualStr} onChange={setFactualStr} numeric />
            <p className="card-note">Может отличаться от суммы в чеке — отразится линией отклонения на графике.</p>
          </div>
        ) : null}

        <button className="btn-primary" style={{ marginTop: 16 }} onClick={save}>
          Сохранить
        </button>
        <div className="btn-row" style={{ marginTop: 9 }}>
          <button className="btn-secondary" onClick={copyAsText} style={{ color: copied ? 'var(--success)' : undefined }}>
            {copied ? 'Скопировано' : 'Скопировать текстом'}
          </button>
          <button className="btn-secondary danger" onClick={confirmDelete}>
            Удалить счёт
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
