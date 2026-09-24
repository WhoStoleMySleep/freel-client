<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
</script>

<template>
  <button class="switch" :class="{ on: model }" :aria-pressed="model" @click="model = !model" />
</template>
