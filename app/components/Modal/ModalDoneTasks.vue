<script setup lang="ts">
defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const fmt = useFormat()
const tasks = useTasksStore()
const projects = useProjectsStore()
const { currency } = storeToRefs(useSettingsStore())

const doneTasks = computed(() => tasks.byStatus.get('done') ?? [])

async function confirmDelete(id: string, title: string): Promise<void> {
  if (!window.confirm(t('doneTasks.confirmDelete', { title }))) return
  await tasks.remove(id)
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="t('doneTasks.title')" @close="emit('close')" />
    <p class="modal-hint">{{ t('doneTasks.hint') }}</p>
    <div class="list">
      <div v-for="task in doneTasks" :key="task.id" class="done-card">
        <div class="done-top">
          <div class="done-title">{{ task.title }}</div>
          <div class="done-title num">{{ fmt.money(taskAmount(task, task.minutes), currency) }}</div>
        </div>
        <div class="done-meta">
          <span>{{ projects.nameOf(task.projectId) }} ·</span>
          <UiIcon name="clock" :size="11" />
          <span>{{ fmt.minutes(task.minutes) }}</span>
          <button class="delete-link" @click="confirmDelete(task.id, task.title)">{{ t('common.delete') }}</button>
        </div>
        <div class="chips">
          <UiChip
            v-for="key in RESTORE_ORDER"
            :key="key"
            :label="t(`status.${key}`)"
            :dot-color="STATUS_COLOR[key]"
            small
            @click="tasks.setStatus(task.id, key)"
          />
        </div>
      </div>

      <p v-if="doneTasks.length === 0" class="modal-hint" style="text-align: center; padding: 30px 0">
        {{ t('doneTasks.empty') }}
      </p>
    </div>
  </UiBottomSheet>
</template>
