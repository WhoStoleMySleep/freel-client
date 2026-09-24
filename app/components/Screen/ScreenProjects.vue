<script setup lang="ts">
type Modal = { type: 'add' } | { type: 'edit', projectId: string } | null

/** Avatar tints, handed out by position so a list reads as distinct rows. */
const TINTS: [string, string][] = [
  ['rgba(108,140,255,0.16)', '#8fa6ff'],
  ['rgba(67,214,160,0.16)', '#43d6a0'],
  ['rgba(245,196,81,0.16)', '#f5c451'],
  ['rgba(185,140,255,0.16)', '#b98cff'],
]

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

const tintOf = (index: number) => TINTS[index % TINTS.length]!
</script>

<template>
  <div class="screen scr">
    <div class="header">
      <div>
        <div class="eyebrow">Управление</div>
        <h1 class="h1">Проекты</h1>
      </div>
    </div>

    <div class="list">
      <button
        v-for="(project, index) in projects"
        :key="project.id"
        class="project-row"
        :style="{ opacity: project.archived ? 0.55 : 1 }"
        @click="modal = { type: 'edit', projectId: project.id }"
      >
        <span class="project-avatar" :style="{ background: tintOf(index)[0], color: tintOf(index)[1] }">
          {{ project.name[0]?.toUpperCase() }}
        </span>
        <span class="project-body">
          <span class="project-name-row">
            <span class="project-name">{{ project.name }}</span>
            <span v-if="project.archived" class="archive-badge">АРХИВ</span>
          </span>
          <span class="project-sub">
            {{ (project.description || 'Без описания') + ' · ' + (openCounts.get(project.id) ?? 0) + ' активн.' }}
          </span>
        </span>
        <UiIcon name="chevron-right" :size="16" color="var(--mute)" :stroke-width="2" />
      </button>
    </div>

    <div v-if="projects.length === 0" class="empty">
      <div class="empty-title">Пока нет проектов</div>
      <p class="empty-text">Нажмите «+», чтобы создать первый проект.</p>
    </div>

    <button class="fab" @click="modal = { type: 'add' }">+</button>

    <ModalProjectForm
      :open="modal?.type === 'add' || modal?.type === 'edit'"
      :project-id="modal?.type === 'edit' ? modal.projectId : null"
      @close="modal = null"
    />
  </div>
</template>
