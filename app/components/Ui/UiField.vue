<script setup lang="ts">
defineProps<{
  label?: string
  placeholder?: string
  multiline?: boolean
  numeric?: boolean
  accent?: boolean
  /** Masks the value — used for the sync account password. */
  secure?: boolean
}>()

const model = defineModel<string>({ required: true })
const area = ref<HTMLTextAreaElement | null>(null)

/**
 * Lets the description field grow downwards instead of scrolling.
 *
 * The height is reset to `auto` and then taken from the element's own
 * `scrollHeight` — the only way to make a textarea shrink again after text is
 * deleted.
 */
function resize(): void {
  const el = area.value
  if (!el) return
  el.style.height = 'auto'
  // `box-sizing: border-box` is global here, so the height being set has to
  // include the borders — `scrollHeight` alone leaves the last line clipped.
  const borders = el.offsetHeight - el.clientHeight
  el.style.height = `${el.scrollHeight + borders}px`
}

watch([model, area], resize, { flush: 'post' })
</script>

<template>
  <label style="display: block">
    <span v-if="label" class="field-label">{{ label }}</span>
    <textarea
      v-if="multiline"
      ref="area"
      v-model="model"
      class="input"
      :class="{ num: numeric, accent }"
      :placeholder="placeholder"
    />
    <input
      v-else
      v-model="model"
      class="input"
      :class="{ num: numeric, accent }"
      :type="secure ? 'password' : 'text'"
      :inputmode="numeric ? 'decimal' : undefined"
      :placeholder="placeholder"
    >
  </label>
</template>
