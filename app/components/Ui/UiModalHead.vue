<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="modal-head">
    <div class="modal-title">{{ title }}</div>
    <button class="modal-close" :aria-label="t('common.close')" @click="emit('close')">✕</button>
  </div>
</template>
