<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const tasks = useTasksStore()
const projects = useProjectsStore()
const invoices = useInvoicesStore()
const { currency } = storeToRefs(useSettingsStore())

const filterProjectId = ref('')
const waiting = computed(() => tasks.byStatus.get('waiting_payment') ?? [])
const visible = computed(() =>
  waiting.value.filter(task => !filterProjectId.value || task.projectId === filterProjectId.value)
)

const { groups, master, chosen, setMany, reset } = useTaskSelection(waiting, visible)
const total = computed(() => chosen.value.reduce((sum, task) => sum + taskAmount(task, task.minutes), 0))

watch(() => props.open, (open) => {
  if (!open) return
  filterProjectId.value = ''
  reset(waiting.value)
})

async function create(): Promise<void> {
  if (!chosen.value.length) return
  await invoices.createFromTasks(chosen.value.map(task => task.id))
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="t('invoiceGen.title')" @close="emit('close')" />
    <p class="modal-hint">{{ t('invoiceGen.hint') }}</p>

    <div class="chips" style="gap: 5px; margin-bottom: 12px">
      <UiChip :label="t('common.all')" :active="filterProjectId === ''" small @click="filterProjectId = ''" />
      <UiChip
        v-for="project in projects.active"
        :key="project.id"
        :label="project.name"
        :active="filterProjectId === project.id"
        small
        @click="filterProjectId = project.id"
      />
    </div>

    <UiTaskPicker
      :groups="groups"
      :master="master"
      :empty-text="t('invoiceGen.empty')"
      @toggle="setMany"
    >
      <template #meta="{ task }">
        <span class="gen-task-meta">
          <UiIcon name="clock" :size="10" /> {{ fmt.minutes(task.minutes) }}
        </span>
      </template>
      <template #trailing="{ task }">
        <span class="inv-item-amount num">{{ fmt.money(taskAmount(task, task.minutes), currency) }}</span>
      </template>
    </UiTaskPicker>

    <div class="sel-summary">
      <span class="sel-count">{{ t('common.selected', { count: chosen.length }) }}</span>
      <span class="sel-total num">{{ fmt.money(total, currency) }}</span>
    </div>

    <button class="btn-primary" style="margin-top: 0" :disabled="!chosen.length" @click="create">
      {{ t('invoiceGen.submit') }}
    </button>
  </UiBottomSheet>
</template>
