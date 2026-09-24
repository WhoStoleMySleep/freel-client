<script setup lang="ts">
/**
 * Mirrors the design's sheet transition: backdrop `fade .2s`, sheet
 * `rise .3s ease`. Closing is the short fade `.backdrop.closing` carries, and
 * Vue keeps the element around for exactly as long as it runs.
 */
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

/** Desktop expects Escape to dismiss a dialog; on a phone it never fires. */
function onKey(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition leave-active-class="closing">
    <div v-if="open" class="backdrop" @click="emit('close')">
      <div class="sheet" @click.stop>
        <div class="sheet-body">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
</template>
