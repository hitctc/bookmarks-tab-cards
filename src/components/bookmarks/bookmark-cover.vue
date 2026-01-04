<template>
  <div class="flex h-full w-full items-center justify-center bg-transparent">
    <img
      v-if="!hasFaviconError"
      class="h-14 w-14 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
      :src="faviconUrl"
      :alt="title"
      @error="handleFaviconError"
    />
    <div v-else class="mx-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
      {{ title }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { getFaviconFallbackUrls } from '@/utils/url';

const props = defineProps<{
  url: string;
  title: string;
}>();

const faviconIndex = ref(0);

// 64px 在 chrome://favicon* 里兼容性更好，同时足够清晰
const faviconCandidates = computed(() => getFaviconFallbackUrls(props.url, 64));

const faviconUrl = computed(() => faviconCandidates.value[faviconIndex.value] || '');

const hasFaviconError = computed(() => !faviconUrl.value);

watch(
  () => props.url,
  () => {
    faviconIndex.value = 0;
  }
);

function handleFaviconError() {
  faviconIndex.value += 1;
  // 所有候选都失败后才会走标题兜底，这里留一个日志方便排查
  if (faviconIndex.value >= faviconCandidates.value.length) {
    // eslint-disable-next-line no-console
    console.warn('[书签卡片] favicon 加载失败', { url: props.url, candidates: faviconCandidates.value });
  }
}
</script>


