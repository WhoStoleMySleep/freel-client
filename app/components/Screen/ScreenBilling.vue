<script setup lang="ts">
import type { Invoice } from '~/types'

type Modal = { type: 'generate' } | { type: 'report' } | { type: 'detail', invoiceId: string } | null

const MAX_MONTHS_BACK = 36
/** How far a finger has to travel before it counts as a month swipe. */
const SWIPE_PX = 40

const { items: invoices } = storeToRefs(useInvoicesStore())
const { items: tasks } = storeToRefs(useTasksStore())
const { currency } = storeToRefs(useSettingsStore())

const monthOffset = ref(0)
const modal = ref<Modal>(null)
const touchX = ref(0)

const canGenerate = computed(() => tasks.value.some(task => task.status === 'waiting_payment'))
const reviewCount = computed(() => tasks.value.filter(task => REVIEW_STATUSES.includes(task.status)).length)

const shown = computed(() => {
  const date = new Date()
  date.setMonth(date.getMonth() + monthOffset.value)
  return { year: date.getFullYear(), month: date.getMonth() }
})
const chart = computed(() => buildMonthChart(invoices.value, shown.value.year, shown.value.month))

const canPrev = computed(() => monthOffset.value > -MAX_MONTHS_BACK)
const canNext = computed(() => monthOffset.value < 0)

function shiftMonth(delta: number): void {
  monthOffset.value = Math.min(0, Math.max(-MAX_MONTHS_BACK, monthOffset.value + delta))
}

function onTouchEnd(event: TouchEvent): void {
  const dx = (event.changedTouches[0]?.clientX ?? 0) - touchX.value
  if (dx > SWIPE_PX && canPrev.value) shiftMonth(-1)
  else if (dx < -SWIPE_PX && canNext.value) shiftMonth(1)
}

/** A paid invoice is worth what actually arrived, not what was asked for. */
const invoiceTotal = (invoice: Invoice) => (invoice.status === 'paid' && invoice.factual != null ? invoice.factual : invoice.total)
</script>

<template>
  <div class="screen scr">
    <div class="header">
      <div>
        <div class="eyebrow">Финансы</div>
        <h1 class="h1">Биллинг и счета</h1>
      </div>
    </div>

    <button class="gen-btn" :disabled="!canGenerate" @click="modal = { type: 'generate' }">
      <UiIcon name="invoice" :size="17" :stroke-width="2.2" />
      Сгенерировать счёт
    </button>
    <p class="gen-hint">
      {{ canGenerate ? 'Есть задачи «Ожидает оплаты»' : 'Нет задач со статусом «Ожидает оплаты»' }}
    </p>

    <button class="gen-btn ghost" @click="modal = { type: 'report' }">
      <UiIcon name="link" :size="17" :stroke-width="2.2" />
      Отчёт по задачам
    </button>
    <p class="gen-hint">
      {{ reviewCount
        ? `На проверке: ${reviewCount} — ссылки или часы на выбор`
        : 'Нет задач на проверке, но статусы можно выбрать в отчёте' }}
    </p>

    <div
      class="chart-card"
      @touchstart="touchX = $event.touches[0]?.clientX ?? 0"
      @touchend="onTouchEnd"
    >
      <div class="chart-head">
        <button class="nav-btn" :disabled="!canPrev" @click="shiftMonth(-1)">
          <UiIcon name="chevron-left" :size="13" />
        </button>
        <div style="text-align: center">
          <div class="chart-month">{{ monthLabel(shown.year, shown.month) }}</div>
          <div class="chart-total num">{{ formatMoney(chart.calculatedTotal, currency) }}</div>
        </div>
        <button class="nav-btn" :disabled="!canNext" @click="shiftMonth(1)">
          <UiIcon name="chevron-right" :size="13" />
        </button>
      </div>

      <svg
        width="100%"
        height="120"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        style="margin-top: 8px; display: block"
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity="0.34" />
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path :d="chart.actualAreaPath" fill="url(#areaGrad)" />
        <path
          v-if="chart.hasDeviation"
          :d="chart.expectedPath"
          fill="none"
          stroke="var(--gold)"
          stroke-width="1.8"
          stroke-dasharray="4 4"
          stroke-linecap="round"
        />
        <path
          :d="chart.actualPath"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>

      <div class="legend">
        <span class="legend-item"><span class="legend-line" />Факт по счетам</span>
        <span class="legend-item"><span class="legend-dash" />Расчётный доход</span>
      </div>
    </div>

    <div class="tasks-head">
      <div class="tasks-title-row">
        <span class="tasks-title">История счетов</span>
        <span class="tasks-count">{{ invoices.length }}</span>
      </div>
    </div>

    <div class="list">
      <button
        v-for="invoice in invoices"
        :key="invoice.id"
        class="invoice-row"
        @click="modal = { type: 'detail', invoiceId: invoice.id }"
      >
        <span style="flex: 1; min-width: 0; padding-right: 8px">
          <span class="invoice-number" style="display: block">Счёт {{ invoice.number }}</span>
          <span class="invoice-sub" style="display: block">
            {{ invoice.projectName }} · {{ invoice.items.length }} задач · {{ shortDate(invoice.dayKey) }}
          </span>
        </span>
        <span style="text-align: right">
          <span class="invoice-total num" style="display: block">
            {{ formatMoney(invoiceTotal(invoice), currency) }}
          </span>
          <span
            class="status-badge"
            :style="{
              background: `${INVOICE_STATUS[invoice.status].color}22`,
              color: INVOICE_STATUS[invoice.status].color,
            }"
          >
            {{ INVOICE_STATUS[invoice.status].label }}
          </span>
        </span>
      </button>
      <p v-if="invoices.length === 0" class="modal-hint" style="text-align: center; padding: 30px 0">
        Пока нет сгенерированных счетов
      </p>
    </div>

    <ModalGenerateInvoice :open="modal?.type === 'generate'" @close="modal = null" />
    <ModalGenerateReport :open="modal?.type === 'report'" @close="modal = null" />
    <ModalInvoiceDetail
      :open="modal?.type === 'detail'"
      :invoice-id="modal?.type === 'detail' ? modal.invoiceId : null"
      @close="modal = null"
    />
  </div>
</template>
