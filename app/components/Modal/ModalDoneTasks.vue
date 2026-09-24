<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const tasks = useTasksStore()
const projects = useProjectsStore()
const { currency } = storeToRefs(useSettingsStore())

const doneTasks = computed(() => tasks.byStatus.get('done') ?? [])

async function confirmDelete(id: string, title: string): Promise<void> {
  if (!window.confirm(`Удалить задачу «${title}»? Всё учтённое по ней время будет удалено безвозвратно.`)) return
  await tasks.remove(id)
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead title="Готовые задачи" @close="emit('close')" />
    <p class="modal-hint">Выберите статус, чтобы вернуть задачу в работу.</p>
    <div class="list">
      <div v-for="task in doneTasks" :key="task.id" class="done-card">
        <div class="done-top">
          <div class="done-title">{{ task.title }}</div>
          <div class="done-title num">{{ formatMoney(taskAmount(task, task.minutes), currency) }}</div>
        </div>
        <div class="done-meta">
          <span>{{ projects.nameOf(task.projectId) }} ·</span>
          <UiIcon name="clock" :size="11" />
          <span>{{ formatMinutes(task.minutes) }}</span>
          <button class="delete-link" @click="confirmDelete(task.id, task.title)">Удалить</button>
        </div>
        <div class="chips">
          <UiChip
            v-for="key in RESTORE_ORDER"
            :key="key"
            :label="STATUS[key].label"
            :dot-color="STATUS[key].color"
            small
            @click="tasks.setStatus(task.id, key)"
          />
        </div>
      </div>

      <p v-if="doneTasks.length === 0" class="modal-hint" style="text-align: center; padding: 30px 0">
        Пока нет готовых задач
      </p>
    </div>
  </UiBottomSheet>
</template>
