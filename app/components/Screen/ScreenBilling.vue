<script setup lang="ts">
import type { Invoice } from '~/types'

type Modal = { type: 'generate' } | { type: 'report' } | { type: 'detail', invoiceId: string } | null

const MAX_MONTHS_BACK = 36
/** How far a finger has to travel before it counts as a month swipe. */
const SWIPE_PX = 40

const { t } = useI18n()
const fmt = useFormat()

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
        <div class="eyebrow">{{ t('billing.eyebrow') }}</div>
        <h1 class="h1 display">{{ t('billing.title') }}</h1>
      </div>
    </div>

    <div class="gen-row">
      <button class="gen-btn" :disabled="!canGenerate" @click="modal = { type: 'generate' }">
        <UiIcon name="invoice" :size="20" />
        <span>
          <span class="gen-btn-title">{{ t('billing.generate') }}</span>
          <span class="gen-btn-sub">{{ canGenerate ? t('billing.canGenerate') : t('billing.cannotGenerate') }}</span>
        </span>
      </button>
      <button class="gen-btn ghost" @click="modal = { type: 'report' }">
        <UiIcon name="link" :size="20" color="var(--accent-text)" />
        <span>
          <span class="gen-btn-title">{{ t('billing.report') }}</span>
          <span class="gen-btn-sub">{{ reviewCount ? t('billing.reviewCount', { count: reviewCount }) : t('billing.noReview') }}</span>
        </span>
      </button>
    </div>

    <div
      class="chart-card"
      @touchstart="touchX = $event.touches[0]?.clientX ?? 0"
      @touchend="onTouchEnd"
    >
      <div class="chart-head">
        <div>
          <div class="chart-month">{{ fmt.monthLabel(shown.year, shown.month) }}</div>
          <div class="chart-total display">{{ fmt.money(chart.calculatedTotal, currency) }}</div>
        </div>
        <div class="chart-nav">
          <button class="nav-btn" :disabled="!canPrev" @click="shiftMonth(-1)">
            <UiIcon name="chevron-left" :size="14" />
          </button>
          <button class="nav-btn" :disabled="!canNext" @click="shiftMonth(1)">
            <UiIcon name="chevron-right" :size="14" />
          </button>
        </div>
      </div>

      <!-- Stretched rather than scaled: the line only has to show the shape of
           the month, and a non-uniform scale keeps the stroke weight even. -->
      <svg
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        preserveAspectRatio="none"
        style="width: 100%; height: 160px; margin-top: 16px; display: block; overflow: visible"
      >
        <line x1="0" :y1="chart.height - 1" :x2="chart.width" :y2="chart.height - 1" stroke="var(--line)" stroke-width="1" />
        <path :d="chart.actualAreaPath" fill="var(--accent)" fill-opacity="0.12" />
        <path
          v-if="chart.hasDeviation"
          :d="chart.expectedPath"
          fill="none"
          stroke="#f2b544"
          stroke-width="1.6"
          stroke-dasharray="5 4"
          vector-effect="non-scaling-stroke"
        />
        <path
          :d="chart.actualPath"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2.4"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <div class="chart-axis num">
        <span>1</span><span>10</span><span>20</span><span>{{ chart.days }}</span>
      </div>

      <div class="legend">
        <span class="legend-item"><span class="legend-line" />{{ t('billing.legendFact') }}</span>
        <span class="legend-item"><span class="legend-dash" />{{ t('billing.legendPlan') }}</span>
      </div>
    </div>

    <div class="tasks-head">
      <div class="tasks-title-row">
        <h2 class="tasks-title display">{{ t('billing.history') }}</h2>
        <span class="tasks-count num">{{ invoices.length }}</span>
      </div>
    </div>

    <div v-if="invoices.length" class="invoice-list">
      <button
        v-for="invoice in invoices"
        :key="invoice.id"
        class="invoice-row"
        @click="modal = { type: 'detail', invoiceId: invoice.id }"
      >
        <span class="invoice-body">
          <span class="invoice-number num">{{ t('billing.invoiceNumber', { number: invoice.number }) }}</span>
          <span class="invoice-sub">
            {{ invoice.projectName }}
            · {{ t('billing.taskCount', { count: invoice.items.length }, invoice.items.length) }}
            · {{ fmt.shortDate(invoice.dayKey) }}
          </span>
        </span>
        <span class="invoice-side">
          <span class="invoice-total num">{{ fmt.money(invoiceTotal(invoice), currency) }}</span>
          <span
            class="status-badge"
            :style="{
              background: `color-mix(in oklch, ${INVOICE_STATUS_COLOR[invoice.status]} 15%, transparent)`,
              color: INVOICE_STATUS_COLOR[invoice.status],
            }"
          >
            {{ t(`invoiceStatus.${invoice.status}`) }}
          </span>
        </span>
      </button>
    </div>
    <p v-else class="modal-hint" style="text-align: center; padding: 30px 0">
      {{ t('billing.empty') }}
    </p>

    <ModalGenerateInvoice :open="modal?.type === 'generate'" @close="modal = null" />
    <ModalGenerateReport :open="modal?.type === 'report'" @close="modal = null" />
    <ModalInvoiceDetail
      :open="modal?.type === 'detail'"
      :invoice-id="modal?.type === 'detail' ? modal.invoiceId : null"
      @close="modal = null"
    />
  </div>
</template>
