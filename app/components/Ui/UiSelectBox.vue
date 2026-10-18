<script setup lang="ts">
import type { MarkState } from '~/types'

/** Tri-state tick used by the row, group and master selectors in both generators. */
const props = defineProps<{ state: MarkState }>()
</script>

<template>
  <span class="checkbox" :class="{ all: props.state === 'all', some: props.state === 'some' }">
    <UiIcon v-if="props.state === 'all'" name="check" :size="12" />
    <span v-if="props.state === 'some'" class="checkbox-dash" />
  </span>
</template>
