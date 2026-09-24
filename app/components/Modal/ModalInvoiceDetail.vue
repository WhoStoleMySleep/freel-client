<script setup lang="ts">
import type { InvoiceStatus } from '~/types'

const props = defineProps<{ open: boolean, invoiceId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const STATUS_OPTIONS = Object.keys(INVOICE_STATUS) as InvoiceStatus[]

const invoices = useInvoicesStore()
const { currency } = storeToRefs(useSettingsStore())

const invoice = computed(() => invoices.items.find(item => item.id === props.invoiceId) ?? null)
const groups = computed(() => groupInvoiceItems(invoice.value?.items ?? []))

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
  await copyText(invoiceToText(current))
  flashCopied(true)
}

async function confirmDelete(): Promise<void> {
  const current = invoice.value
  if (!current) return
  if (!window.confirm('Удалить счёт? Он будет удалён безвозвратно. Задачи в нём останутся со статусом «Готово».')) return
  await invoices.remove(current.id)
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <template v-if="invoice">
      <UiModalHead :title="`Счёт ${invoice.number}`" @close="emit('close')" />
      <p class="modal-hint" style="margin-top: -10px">
        {{ invoice.projectName }} · {{ shortDate(invoice.dayKey) }}
      </p>

      <div class="list" style="gap: 12px">
        <div v-for="group in groups" :key="group.name" class="inv-group">
          <div class="inv-group-head">
            <span class="inv-group-name">{{ group.name }}</span>
            <span class="inv-group-subtotal num">{{ formatMoney(group.subtotal, currency) }}</span>
          </div>
          <div v-for="item in group.items" :key="item.id" class="inv-item">
            <div style="flex: 1">
              <div class="inv-item-title">{{ item.title }}</div>
              <div class="inv-item-hours">
                <UiIcon name="clock" :size="10" /> {{ formatMinutes(item.minutes) }}
              </div>
            </div>
            <div class="inv-item-amount num">{{ formatMoney(item.amount, currency) }}</div>
          </div>
        </div>
        <div class="inv-total">
          <span class="inv-total-label">Итого по счёту</span>
          <span class="inv-total-value num">{{ formatMoney(invoice.total, currency) }}</span>
        </div>
      </div>

      <div class="field-label" style="margin-top: 18px">Статус счёта</div>
      <div class="chips" style="gap: 7px">
        <UiChip
          v-for="key in STATUS_OPTIONS"
          :key="key"
          :label="INVOICE_STATUS[key].label"
          :active="status === key"
          grow
          small
          @click="status = key"
        />
      </div>

      <div v-if="status === 'paid'" style="margin-top: 14px">
        <UiField v-model="factualStr" label="Фактически получено" numeric />
        <p class="card-note">Может отличаться от суммы в чеке — отразится линией отклонения на графике.</p>
      </div>

      <button class="btn-primary" style="margin-top: 16px" @click="save">Сохранить</button>
      <div class="btn-row" style="margin-top: 9px">
        <button class="btn-secondary" :style="{ color: copied ? 'var(--success)' : undefined }" @click="copyAsText">
          {{ copied ? 'Скопировано' : 'Скопировать текстом' }}
        </button>
        <button class="btn-secondary danger" @click="confirmDelete">Удалить счёт</button>
      </div>
    </template>
  </UiBottomSheet>
</template>
