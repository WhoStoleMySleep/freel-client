<script setup lang="ts">
defineProps<{
  label: string
  active?: boolean
  /** Colour of the marker in front of the label. */
  dotColor?: string
  /** Statuses are marked with a circle, projects with a square. */
  round?: boolean
  small?: boolean
}>()
</script>

<template>
  <button class="chip" :class="{ small, active }">
    <span v-if="dotColor" class="chip-dot" :class="{ round }" :style="{ background: dotColor }" />
    {{ label }}
  </button>
</template>
