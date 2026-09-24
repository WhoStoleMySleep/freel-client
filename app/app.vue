<script setup lang="ts">
/**
 * Both windows load this same document; the window's label decides which one
 * is rendered. The panel has no URL of its own on purpose: the bundle ships as
 * static files with no server behind it, so a second route would have to exist
 * as a file, and `tauri://` hands the webview that file's path — which the
 * router then fails to match.
 */
const isPanel = windowLabel() === 'panel'

// The panel's window is transparent; the surface, its rounded edge and the
// shadow come from `.panel` itself, so the body underneath must not paint.
if (isPanel) useHead({ bodyAttrs: { class: 'panel-window' } })
</script>

<template>
  <PanelWindow v-if="isPanel" />
  <MainWindow v-else />
</template>
