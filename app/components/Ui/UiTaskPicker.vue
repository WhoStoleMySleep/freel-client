<script setup lang="ts">
import type { TaskGroup, TaskMaster } from '~/types'

/** The tick list both generators are built on: master row, project groups, task rows. */
const props = defineProps<{
  groups: TaskGroup[]
  master: TaskMaster
  /** Shown instead of the list when the filter leaves nothing. */
  emptyText: string
}>()

const emit = defineEmits<{ toggle: [ids: string[], value: boolean] }>()

const { t } = useI18n()

const visibleIds = computed(() => props.groups.flatMap(group => group.rows.map(row => row.task.id)))

function idsOf(group: TaskGroup): string[] {
  return group.rows.map(row => row.task.id)
}
</script>

<template>
  <button v-if="master.total > 0" class="master-row" @click="emit('toggle', visibleIds, master.state !== 'all')">
    <UiSelectBox :state="master.state" />
    <span class="master-label">{{ master.state === 'all' ? t('picker.clearAll') : t('picker.selectAll') }}</span>
    <span class="counter num">{{ master.selected }}/{{ master.total }}</span>
  </button>

  <div class="list" style="gap: 12px">
    <div v-for="group in groups" :key="group.projectId" class="gen-group">
      <button class="gen-group-head" @click="emit('toggle', idsOf(group), group.state !== 'all')">
        <UiSelectBox :state="group.state" />
        <span class="chip-dot" :style="{ background: projectColor(group.projectId) }" />
        <span class="gen-group-name">{{ group.name }}</span>
        <span class="counter num">{{ group.selectedCount }}/{{ group.rows.length }}</span>
        <slot name="groupTrailing" :group="group" />
      </button>
      <button
        v-for="row in group.rows"
        :key="row.task.id"
        class="gen-task"
        @click="emit('toggle', [row.task.id], !row.selected)"
      >
        <UiSelectBox :state="row.selected ? 'all' : 'none'" />
        <span class="gen-task-body">
          <span class="gen-task-title">{{ row.task.title }}</span>
          <slot name="meta" :task="row.task" />
        </span>
        <slot name="trailing" :task="row.task" />
      </button>
    </div>

    <p v-if="master.total === 0" class="modal-hint" style="text-align: center; padding: 20px 0">
      {{ emptyText }}
    </p>
  </div>
</template>
