<script setup lang="ts">
import type { TaskGroup } from '~/types'

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

/** What this project contributes to the invoice, shown on its group header. */
function subtotalOf(group: TaskGroup): number {
  return group.rows
    .filter(row => row.selected)
    .reduce((sum, row) => sum + taskAmount(row.task, row.task.minutes), 0)
}

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

    <div class="chips scroll" style="margin-bottom: 16px">
      <UiChip :label="t('common.all')" :active="filterProjectId === ''" @click="filterProjectId = ''" />
      <UiChip
        v-for="project in projects.active"
        :key="project.id"
        :label="project.name"
        :dot-color="projectColor(project.id)"
        :active="filterProjectId === project.id"
        @click="filterProjectId = project.id"
      />
    </div>

    <UiTaskPicker
      :groups="groups"
      :master="master"
      :empty-text="t('invoiceGen.empty')"
      @toggle="setMany"
    >
      <template #groupTrailing="{ group }">
        <span class="gen-group-subtotal num">{{ fmt.money(subtotalOf(group), currency) }}</span>
      </template>
      <template #meta="{ task }">
        <span class="gen-task-meta num">
          <UiIcon name="clock" :size="12" /> {{ fmt.minutes(task.minutes) }}
        </span>
      </template>
      <template #trailing="{ task }">
        <span class="gen-task-amount num">{{ fmt.money(taskAmount(task, task.minutes), currency) }}</span>
      </template>
    </UiTaskPicker>

    <div class="sticky-foot">
      <div class="sel-summary">
        <span class="sel-count">{{ t('common.selected', { count: chosen.length }) }}</span>
        <span class="sel-total display">{{ fmt.money(total, currency) }}</span>
      </div>
      <button class="btn-primary" :disabled="!chosen.length" @click="create">
        {{ t('invoiceGen.submit') }}
      </button>
    </div>
  </UiBottomSheet>
</template>
