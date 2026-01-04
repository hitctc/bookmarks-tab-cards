<template>
  <div
    class="flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      v-if="!hasFaviconError"
      class="block"
      :style="{ width: `${Math.floor(size * 0.7)}px`, height: `${Math.floor(size * 0.7)}px` }"
      :src="faviconUrl"
      :alt="title"
      @error="handleFaviconError"
    />
    <span v-else class="text-sm font-semibold">{{ fallbackText }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import { getFaviconUrl } from '@/utils/url';

const props = withDefaults(
  defineProps<{
    url: string;
    title: string;
    domain?: string;
    size?: number;
  }>(),
  {
    domain: '',
    size: 40,
  }
);

const hasFaviconError = ref(false);

const faviconUrl = computed(() => getFaviconUrl(props.url, 64));

const fallbackText = computed(() => {
  const text = (props.domain || props.title || '?').trim();
  return (text[0] || '?').toUpperCase();
});

function handleFaviconError() {
  hasFaviconError.value = true;
}
</script>


