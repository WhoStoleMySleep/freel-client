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
          <div class="done-body">
            <span class="done-title">{{ task.title }}</span>
            <span class="done-meta">
              <span class="task-project">
                <span class="task-project-dot" :style="{ background: projectColor(task.projectId) }" />
                {{ projects.nameOf(task.projectId) }}
              </span>
              <span class="task-time num">
                <UiIcon name="clock" :size="12" /> {{ fmt.minutes(task.minutes) }}
              </span>
            </span>
          </div>
          <div class="done-side">
            <span class="done-amount num">{{ fmt.money(taskAmount(task, task.minutes), currency) }}</span>
            <button class="delete-link" @click="confirmDelete(task.id, task.title)">{{ t('common.delete') }}</button>
          </div>
        </div>
        <div class="chips scroll">
          <UiChip
            v-for="key in RESTORE_ORDER"
            :key="key"
            :label="t(`status.${key}`)"
            :dot-color="STATUS_COLOR[key]"
            round
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
