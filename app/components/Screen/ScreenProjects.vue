<script setup lang="ts">
type Modal = { type: 'add' } | { type: 'edit', projectId: string } | null

const { t } = useI18n()
const modal = ref<Modal>(null)
const { items: projects } = storeToRefs(useProjectsStore())
const { items: tasks } = storeToRefs(useTasksStore())

const openCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const task of tasks.value) {
    if (task.status === 'done') continue
    counts.set(task.projectId, (counts.get(task.projectId) ?? 0) + 1)
  }
  return counts
})
</script>

<template>
  <div class="screen scr">
    <div class="header">
      <div>
        <div class="eyebrow">{{ t('projects.eyebrow') }}</div>
        <h1 class="h1 display">{{ t('projects.title') }}</h1>
      </div>
      <span class="tasks-count num">{{ t('projects.totalCount', projects.length) }}</span>
    </div>

    <div class="project-grid">
      <button
        v-for="project in projects"
        :key="project.id"
        class="project-card"
        :style="{ opacity: project.archived ? 0.55 : 1 }"
        @click="modal = { type: 'edit', projectId: project.id }"
      >
        <span class="project-card-top">
          <span
            class="project-avatar"
            :style="{ background: projectTint(project.id), color: projectColor(project.id) }"
          >
            {{ projectLetter(project.name) }}
          </span>
          <span
            class="project-active num"
            :class="{ any: (openCounts.get(project.id) ?? 0) > 0 }"
          >
            {{ t('projects.activeCount', { count: openCounts.get(project.id) ?? 0 }) }}
          </span>
        </span>
        <span class="project-body">
          <span class="project-name-row">
            <span class="project-name">{{ project.name }}</span>
            <span v-if="project.archived" class="archive-badge">{{ t('projects.archived') }}</span>
          </span>
          <span class="project-sub">{{ project.description || t('projects.noDescription') }}</span>
        </span>
      </button>
    </div>

    <div v-if="projects.length === 0" class="empty">
      <div class="empty-title">{{ t('projects.empty') }}</div>
      <p class="empty-text">{{ t('projects.emptyHint') }}</p>
    </div>

    <button class="fab" :aria-label="t('projectForm.create')" @click="modal = { type: 'add' }">
      <UiIcon name="plus" :size="22" />
    </button>

    <ModalProjectForm
      :open="modal?.type === 'add' || modal?.type === 'edit'"
      :project-id="modal?.type === 'edit' ? modal.projectId : null"
      @close="modal = null"
    />
  </div>
</template>
