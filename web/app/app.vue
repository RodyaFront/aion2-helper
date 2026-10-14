<script setup lang="ts">
import { useBossStore } from '../stores/bosses'
import { useSettingsStore } from '../stores/settings'

const bosses = useBossStore()
const settings = useSettingsStore()
const bootReady = computed(() => bosses.hydrated && settings.hydrated)
</script>

<template>
  <div
    v-if="!bootReady"
    class="boot-shell"
    aria-busy="true"
    aria-label="Загрузка трекера"
  >
    <aside class="boot-sidebar" aria-hidden="true">
      <div class="skel skel-brand" />
      <div class="skel skel-line" />
      <div class="skel skel-nav" />
      <div class="skel skel-nav" />
      <div class="skel skel-util" />
    </aside>
    <div class="boot-main">
      <div class="boot-stats">
        <div v-for="n in 3" :key="n" class="skel skel-stat" />
      </div>
      <div class="boot-toolbar">
        <div class="skel skel-search" />
        <div class="skel skel-filters" />
        <div class="skel skel-add" />
      </div>
      <div class="boot-grid">
        <div v-for="n in 6" :key="n" class="skel-card">
          <div class="skel skel-art" />
          <div class="skel-card-body">
            <div class="skel skel-name" />
            <div class="skel skel-meta" />
            <div class="skel skel-timer" />
            <div class="skel skel-btn" />
          </div>
        </div>
      </div>
    </div>
  </div>
  <NuxtLayout v-else>
    <NuxtPage />
  </NuxtLayout>
</template>
