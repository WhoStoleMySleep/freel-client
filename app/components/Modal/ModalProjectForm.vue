<script setup lang="ts">
const props = defineProps<{ open: boolean, projectId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const projects = useProjectsStore()
const project = computed(() => (props.projectId ? projects.byId.get(props.projectId) ?? null : null))

const name = ref('')
const description = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  name.value = project.value?.name ?? ''
  description.value = project.value?.description ?? ''
})

async function save(): Promise<void> {
  const trimmed = name.value.trim()
  if (!trimmed) return
  const current = project.value
  if (current) await projects.edit(current.id, { name: trimmed, description: description.value })
  else await projects.add({ name: trimmed, description: description.value })
  emit('close')
}

async function confirmDelete(): Promise<void> {
  const current = project.value
  if (!current) return
  if (!window.confirm('Удалить проект навсегда? Все задачи этого проекта будут безвозвратно удалены.')) return
  await projects.removeForever(current.id)
  emit('close')
}
</script>

<template>
  <UiBottomSheet :open="open" @close="emit('close')">
    <UiModalHead :title="project ? 'Проект' : 'Новый проект'" @close="emit('close')" />
    <div class="stack">
      <UiField v-model="name" label="Название проекта" />
      <UiField v-model="description" label="Описание (опционально)" multiline />

      <button class="btn-primary" @click="save">
        {{ project ? 'Сохранить' : 'Создать' }}
      </button>

      <template v-if="project">
        <div class="btn-row">
          <button class="btn-secondary" @click="projects.setArchived(project.id, !project.archived)">
            {{ project.archived ? 'Восстановить из архива' : 'Архивировать проект' }}
          </button>
          <button v-if="project.archived" class="btn-secondary danger" @click="confirmDelete">
            Удалить навсегда
          </button>
        </div>
        <p v-if="project.archived" class="card-note" style="text-align: center">
          Проект в архиве — данные сохранены
        </p>
      </template>
    </div>
  </UiBottomSheet>
</template>
