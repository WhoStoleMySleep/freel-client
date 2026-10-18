<script setup lang="ts">
import type { InvoiceStatus, Locale } from '~/types'

const props = defineProps<{ open: boolean, invoiceId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const STATUS_OPTIONS = Object.keys(INVOICE_STATUS_COLOR) as InvoiceStatus[]

const { t, locale } = useI18n()
const fmt = useFormat()
const invoices = useInvoicesStore()
const { currency } = storeToRefs(useSettingsStore())

const invoice = computed(() => invoices.items.find(item => item.id === props.invoiceId) ?? null)
const groups = computed(() => groupInvoiceItems(invoice.value?.items ?? [], t('invoice.unnamedProject')))

const status = ref<InvoiceStatus>('awaiting')
const factualStr = ref('')
const { value: copied, flash: flashCopied } = useFlash(false, 2000)

watch(() => props.open, (open) => {
  const current = invoice.value
  if (!open || !current) return
  status.value = current.status
  factualStr.value = String(current.factual ?? current.total)
  flashCopied(false)
})

async function save(): Promise<void> {
  const current = invoice.value
  if (!current) return
  await invoices.setStatus(current.id, status.value, parseFloat(factualStr.value) || current.total)
  emit('close')
}

async function copyAsText(): Promise<void> {
  const current = invoice.value
  if (!current) return
  await copyText(invoiceToText(current, { locale: locale.value as Locale, t }))
  flashCopied(true)
}

async function confirmDelete(): Promise<void> {
  const current = invoice.value
  if (!current) return
  if (!window.confirm(t('invoiceDetail.confirmDelete'))) return
  await invoices.remove(current.id)
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <template v-if="invoice">
      <div class="modal-head">
        <div>
          <h3 class="modal-title num">{{ t('invoiceDetail.title', { number: invoice.number }) }}</h3>
          <div class="invoice-sub" style="margin-top: 6px">
            {{ invoice.projectName }} · {{ fmt.shortDate(invoice.dayKey) }}
          </div>
        </div>
        <button class="modal-close" :aria-label="t('common.close')" @click="emit('close')">×</button>
      </div>

      <div class="inv-sheet">
        <div v-for="group in groups" :key="group.name" class="inv-group">
          <div class="inv-group-head">
            <span class="chip-dot" :style="{ background: projectColor(group.name) }" />
            <span class="inv-group-name">{{ group.name }}</span>
            <span class="inv-group-count num">{{ group.items.length }}</span>
            <span class="inv-group-subtotal num">{{ fmt.money(group.subtotal, currency) }}</span>
          </div>
          <div v-for="item in group.items" :key="item.id" class="inv-item">
            <div class="inv-item-body">
              <span class="inv-item-title">{{ item.title }}</span>
              <span class="inv-item-hours num">
                <UiIcon name="clock" :size="12" /> {{ fmt.minutes(item.minutes) }}
              </span>
            </div>
            <span class="inv-item-amount num">{{ fmt.money(item.amount, currency) }}</span>
          </div>
        </div>
        <div class="inv-total">
          <span class="inv-total-label">{{ t('invoiceDetail.total') }}</span>
          <span class="inv-total-value display">{{ fmt.money(invoice.total, currency) }}</span>
        </div>
      </div>

      <div style="margin-top: 18px">
        <span class="field-label">{{ t('invoiceDetail.statusLabel') }}</span>
        <div class="segmented three">
          <button
            v-for="key in STATUS_OPTIONS"
            :key="key"
            class="segment"
            :class="{ active: status === key }"
            @click="status = key"
          >
            {{ t(`invoiceStatus.${key}`) }}
          </button>
        </div>
      </div>

      <div v-if="status === 'paid'" style="margin-top: 18px">
        <UiField v-model="factualStr" :label="t('invoiceDetail.factual')" numeric />
        <span class="field-hint">{{ t('invoiceDetail.factualHint') }}</span>
      </div>

      <button class="btn-primary" style="margin-top: 18px" @click="save">{{ t('common.save') }}</button>
      <div class="btn-row" style="margin-top: 8px">
        <button class="btn-secondary" :style="{ color: copied ? 'var(--green-text)' : undefined }" @click="copyAsText">
          {{ copied ? t('common.copied') : t('invoiceDetail.copy') }}
        </button>
        <button class="btn-secondary danger" @click="confirmDelete">{{ t('invoiceDetail.remove') }}</button>
      </div>
    </template>
  </UiBottomSheet>
</template>
