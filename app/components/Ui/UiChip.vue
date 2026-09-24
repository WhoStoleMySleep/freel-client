<script setup lang="ts">
defineProps<{
  label: string
  active?: boolean
  /** Colour of the status square in front of the label. */
  dotColor?: string
  small?: boolean
  grow?: boolean
}>()
</script>

<template>
  <button class="chip" :class="{ small, grow, active }">
    <span v-if="dotColor" class="chip-dot" :style="{ background: dotColor }" />
    {{ label }}
  </button>
</template>
