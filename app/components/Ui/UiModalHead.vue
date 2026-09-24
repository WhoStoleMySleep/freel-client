<script setup lang="ts">
defineProps<{ title: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <div class="modal-head">
    <div class="modal-title">{{ title }}</div>
    <button class="modal-close" aria-label="Закрыть" @click="emit('close')">✕</button>
  </div>
</template>
