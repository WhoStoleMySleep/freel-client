<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

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
    <UiModalHead title="Новый счёт" @close="emit('close')" />
    <p class="modal-hint">Задачи со статусом «Ожидает оплаты», сгруппированы по проектам. Пустой фильтр = все.</p>

    <div class="chips" style="gap: 5px; margin-bottom: 12px">
      <UiChip label="Все" :active="filterProjectId === ''" small @click="filterProjectId = ''" />
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
      empty-text="Нет задач «Ожидает оплаты» по этому фильтру"
      @toggle="setMany"
    >
      <template #meta="{ task }">
        <span class="gen-task-meta">
          <UiIcon name="clock" :size="10" /> {{ formatMinutes(task.minutes) }}
        </span>
      </template>
      <template #trailing="{ task }">
        <span class="inv-item-amount num">{{ formatMoney(taskAmount(task, task.minutes), currency) }}</span>
      </template>
    </UiTaskPicker>

    <div class="sel-summary">
      <span class="sel-count">Выбрано: {{ chosen.length }}</span>
      <span class="sel-total num">{{ formatMoney(total, currency) }}</span>
    </div>

    <button class="btn-primary" style="margin-top: 0" :disabled="!chosen.length" @click="create">
      Создать счёт
    </button>
  </UiBottomSheet>
</template>
