<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="modal-head">
    <h3 class="modal-title display">{{ title }}</h3>
    <button class="modal-close" :aria-label="t('common.close')" @click="emit('close')">×</button>
  </div>
</template>
