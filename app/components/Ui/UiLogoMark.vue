<script setup lang="ts">
/** The logo: a timer ring and an «f» — the same outline as the build icons. */
withDefaults(defineProps<{ size?: number }>(), { size: 56 })
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 1024 1024" fill="none">
    <defs>
      <linearGradient id="logoRing" x1="290" y1="270" x2="740" y2="750" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#8aa2ff" />
        <stop offset="0.5" stop-color="#6c8cff" />
        <stop offset="1" stop-color="#43d6a0" />
      </linearGradient>
    </defs>
    <g fill="none" stroke-linecap="round">
      <path d="M 589.6 222.2 A 300 300 0 1 0 783.9 385.2" stroke="url(#logoRing)" stroke-width="70" />
      <path d="M 470 706 L 470 432 C 470 352 532 316 610 340" stroke="#fff" stroke-width="76" />
      <path d="M 396 512 L 594 512" stroke="#f5c451" stroke-width="70" />
    </g>
  </svg>
</template>
