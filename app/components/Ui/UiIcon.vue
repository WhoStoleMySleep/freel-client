<script setup lang="ts">
import type { IconName, IconShape } from '~/types'

const props = defineProps<{
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
}>()

const def = computed(() => ICONS[props.name])
const px = computed(() => props.size ?? def.value.size ?? 16)
const paint = computed(() => props.color ?? 'currentColor')

/** Geometry of one shape, minus the tag that decides which element draws it. */
function attrsOf(shape: IconShape): Record<string, number | string> {
  const attrs: Record<string, number | string> = { ...shape }
  delete attrs.tag
  return attrs
}
</script>

<template>
  <svg
    :width="px"
    :height="px"
    viewBox="0 0 24 24"
    :fill="def.filled ? paint : 'none'"
    :stroke="def.filled ? undefined : paint"
    :stroke-width="def.filled ? undefined : (strokeWidth ?? def.strokeWidth ?? 2)"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <component :is="shape.tag" v-for="(shape, i) in def.shapes" :key="i" v-bind="attrsOf(shape)" />
  </svg>
</template>
