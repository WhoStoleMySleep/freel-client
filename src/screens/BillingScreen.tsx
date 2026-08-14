import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildMonthChart } from '../domain/chart';
import { formatMoney } from '../domain/money';
import { INVOICE_STATUS } from '../domain/status';
import { monthLabel, shortDate } from '../utils/date';
import { GenerateInvoiceModal } from '../modals/GenerateInvoiceModal';
import { InvoiceDetailModal } from '../modals/InvoiceDetailModal';
import { IconChevronLeft, IconChevronRight, IconInvoice } from '../components/icons';

const MAX_MONTHS_BACK = 36;
type ModalState = { type: 'generate' } | { type: 'detail'; invoiceId: string } | null;

export function BillingScreen() {
  const invoices = useAppStore((s) => s.invoices);
  const tasks = useAppStore((s) => s.tasks);
  const currency = useAppStore((s) => s.settings.currency);
  const [monthOffset, setMonthOffset] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const touchX = useRef(0);

  const canGenerate = tasks.some((t) => t.status === 'waiting_payment');

  const { year, month } = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() };
  }, [monthOffset]);

  const chart = useMemo(() => buildMonthChart(invoices, year, month), [invoices, year, month]);
  const canPrev = monthOffset > -MAX_MONTHS_BACK;
  const canNext = monthOffset < 0;

  return (
    <div className="screen scr">
      <div className="header">
        <div>
          <div className="eyebrow">Финансы</div>
          <h1 className="h1">Биллинг и счета</h1>
        </div>
      </div>

      <button className="gen-btn" disabled={!canGenerate} onClick={() => setModal({ type: 'generate' })}>
        <IconInvoice size={17} strokeWidth={2.2} />
        Сгенерировать счёт
      </button>
      <p className="gen-hint">
        {canGenerate ? 'Есть задачи «Ожидает оплаты»' : 'Нет задач со статусом «Ожидает оплаты»'}
      </p>

      <div
        className="chart-card"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (dx > 40 && canPrev) setMonthOffset((v) => Math.max(-MAX_MONTHS_BACK, v - 1));
          else if (dx < -40 && canNext) setMonthOffset((v) => Math.min(0, v + 1));
        }}
      >
        <div className="chart-head">
          <button className="nav-btn" disabled={!canPrev} onClick={() => setMonthOffset((v) => Math.max(-MAX_MONTHS_BACK, v - 1))}>
            <IconChevronLeft size={13} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div className="chart-month">{monthLabel(year, month)}</div>
            <div className="chart-total num">{formatMoney(chart.calculatedTotal, currency)}</div>
          </div>
          <button className="nav-btn" disabled={!canNext} onClick={() => setMonthOffset((v) => Math.min(0, v + 1))}>
            <IconChevronRight size={13} />
          </button>
        </div>

        <svg width="100%" height={120} viewBox={`0 0 ${chart.width} ${chart.height}`} style={{ marginTop: 8, display: 'block' }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.34" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={chart.actualAreaPath} fill="url(#areaGrad)" />
          {chart.hasDeviation ? (
            <path d={chart.expectedPath} fill="none" stroke="var(--gold)" strokeWidth={1.8} strokeDasharray="4 4" strokeLinecap="round" />
          ) : null}
          <path d={chart.actualPath} fill="none" stroke="var(--accent)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div className="legend">
          <span className="legend-item">
            <span className="legend-line" />
            Факт по счетам
          </span>
          <span className="legend-item">
            <span className="legend-dash" />
            Расчётный доход
          </span>
        </div>
      </div>

      <div className="tasks-head">
        <div className="tasks-title-row">
          <span className="tasks-title">История счетов</span>
          <span className="tasks-count">{invoices.length}</span>
        </div>
      </div>

      <div className="list">
        {invoices.map((inv) => {
          const st = INVOICE_STATUS[inv.status];
          const total = inv.status === 'paid' && inv.factual != null ? inv.factual : inv.total;
          return (
            <button className="invoice-row" key={inv.id} onClick={() => setModal({ type: 'detail', invoiceId: inv.id })}>
              <span style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                <span className="invoice-number" style={{ display: 'block' }}>
                  Счёт {inv.number}
                </span>
                <span className="invoice-sub" style={{ display: 'block' }}>
                  {inv.projectName} · {inv.items.length} задач · {shortDate(inv.dayKey)}
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className="invoice-total num" style={{ display: 'block' }}>
                  {formatMoney(total, currency)}
                </span>
                <span className="status-badge" style={{ background: st.color + '22', color: st.color }}>
                  {st.label}
                </span>
              </span>
            </button>
          );
        })}
        {invoices.length === 0 ? (
          <p className="modal-hint" style={{ textAlign: 'center', padding: '30px 0' }}>
            Пока нет сгенерированных счетов
          </p>
        ) : null}
      </div>

      <GenerateInvoiceModal open={modal?.type === 'generate'} onClose={() => setModal(null)} />
      <InvoiceDetailModal
        open={modal?.type === 'detail'}
        invoiceId={modal?.type === 'detail' ? modal.invoiceId : null}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
