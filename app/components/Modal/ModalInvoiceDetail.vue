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
      <UiModalHead :title="t('invoiceDetail.title', { number: invoice.number })" @close="emit('close')" />
      <p class="modal-hint" style="margin-top: -10px">
        {{ invoice.projectName }} · {{ fmt.shortDate(invoice.dayKey) }}
      </p>

      <div class="list" style="gap: 12px">
        <div v-for="group in groups" :key="group.name" class="inv-group">
          <div class="inv-group-head">
            <span class="inv-group-name">{{ group.name }}</span>
            <span class="inv-group-subtotal num">{{ fmt.money(group.subtotal, currency) }}</span>
          </div>
          <div v-for="item in group.items" :key="item.id" class="inv-item">
            <div style="flex: 1">
              <div class="inv-item-title">{{ item.title }}</div>
              <div class="inv-item-hours">
                <UiIcon name="clock" :size="10" /> {{ fmt.minutes(item.minutes) }}
              </div>
            </div>
            <div class="inv-item-amount num">{{ fmt.money(item.amount, currency) }}</div>
          </div>
        </div>
        <div class="inv-total">
          <span class="inv-total-label">{{ t('invoiceDetail.total') }}</span>
          <span class="inv-total-value num">{{ fmt.money(invoice.total, currency) }}</span>
        </div>
      </div>

      <div class="field-label" style="margin-top: 18px">{{ t('invoiceDetail.statusLabel') }}</div>
      <div class="chips" style="gap: 7px">
        <UiChip
          v-for="key in STATUS_OPTIONS"
          :key="key"
          :label="t(`invoiceStatus.${key}`)"
          :active="status === key"
          grow
          small
          @click="status = key"
        />
      </div>

      <div v-if="status === 'paid'" style="margin-top: 14px">
        <UiField v-model="factualStr" :label="t('invoiceDetail.factual')" numeric />
        <p class="card-note">{{ t('invoiceDetail.factualHint') }}</p>
      </div>

      <button class="btn-primary" style="margin-top: 16px" @click="save">{{ t('common.save') }}</button>
      <div class="btn-row" style="margin-top: 9px">
        <button class="btn-secondary" :style="{ color: copied ? 'var(--success)' : undefined }" @click="copyAsText">
          {{ copied ? t('common.copied') : t('invoiceDetail.copy') }}
        </button>
        <button class="btn-secondary danger" @click="confirmDelete">{{ t('invoiceDetail.remove') }}</button>
      </div>
    </template>
  </UiBottomSheet>
</template>
