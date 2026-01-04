<template>
  <div ref="coverRef" class="relative h-full w-full overflow-hidden">
    <img
      v-if="shouldShowPreviewImage"
      class="h-full w-full object-cover"
      :src="previewDataUrl ?? undefined"
      :alt="title"
    />

    <iframe
      v-else-if="shouldShowIframe"
      :key="iframeKey"
      class="pointer-events-none"
      :src="url"
      :style="iframeStyle"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      @load="handleIframeLoad"
    />

    <div v-else class="flex h-full w-full items-center justify-center bg-transparent">
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

    <button
      v-if="settingsStore.settings.enableSitePreviews && !isCapturing"
      type="button"
      class="absolute right-2 top-2 z-10 rounded-md bg-white/80 px-2 py-1 text-xs font-medium text-slate-700 opacity-0 backdrop-blur transition hover:bg-white group-hover:opacity-100 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-900"
      title="刷新预览图"
      @click.stop.prevent="handleRefreshPreview"
    >
      刷新
    </button>

    <div
      v-if="isGeneratingPreview && !isCapturing"
      class="absolute inset-0 flex items-center justify-center bg-slate-100/60 dark:bg-slate-800/60"
    >
      <a-spin size="small" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useElementSize, useIntersectionObserver } from '@vueuse/core';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { captureElementPreviewDataUrl, getSitePreviewFromCache, setSitePreviewToCache } from '@/services/site-preview-service';
import { useSettingsStore } from '@/stores/settings-store';
import { getFaviconFallbackUrls } from '@/utils/url';

const props = defineProps<{
  url: string;
  title: string;
}>();

const settingsStore = useSettingsStore();

const faviconIndex = ref(0);

// 64px 在 chrome://favicon* 里兼容性更好，同时足够清晰
const faviconCandidates = computed(() => getFaviconFallbackUrls(props.url, 64));

const faviconUrl = computed(() => faviconCandidates.value[faviconIndex.value] || '');

const hasFaviconError = computed(() => !faviconUrl.value);

const coverRef = ref<HTMLElement | null>(null);
const isCoverVisible = ref(false);
const { width: coverWidth } = useElementSize(coverRef);

const previewDataUrl = ref<string | null>(null);
const isGeneratingPreview = ref(false);
const isCapturing = ref(false);
const iframeKey = ref(0);
const previewGenerationId = ref(0);
const hasTriedAutoGenerate = ref(false);
const isDisposed = ref(false);

const shouldShowPreviewImage = computed(() => {
  if (!settingsStore.settings.enableSitePreviews) return false;
  return !!previewDataUrl.value;
});

const shouldShowIframe = computed(() => {
  if (!settingsStore.settings.enableSitePreviews) return false;
  return !previewDataUrl.value && isGeneratingPreview.value;
});

const iframeStyle = computed(() => {
  // 让 iframe 用“桌面端视口”渲染，再等比缩放进卡片，截图会更像常见的站点预览图
  const viewportW = 1280;
  const viewportH = 720;
  const w = Number(coverWidth.value || 0);
  const scale = w > 0 ? w / viewportW : 0.25;
  return {
    width: `${viewportW}px`,
    height: `${viewportH}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  };
});

watch(
  () => props.url,
  () => void syncForUrl()
);

function handleFaviconError() {
  faviconIndex.value += 1;
  // 所有候选都失败后才会走标题兜底，这里留一个日志方便排查
  if (faviconIndex.value >= faviconCandidates.value.length) {
    // eslint-disable-next-line no-console
    console.warn('[书签卡片] favicon 加载失败', { url: props.url, candidates: faviconCandidates.value });
  }
}

watch(
  () => settingsStore.settings.enableSitePreviews,
  () => void syncForUrl()
);

useIntersectionObserver(
  coverRef,
  (entries) => {
    const entry = entries[0];
    isCoverVisible.value = !!entry?.isIntersecting;
    if (isCoverVisible.value) void maybeAutoGeneratePreview();
  },
  { threshold: 0.2 }
);

onMounted(() => {
  void syncForUrl();
});

onBeforeUnmount(() => {
  isDisposed.value = true;
});

async function syncForUrl() {
  faviconIndex.value = 0;
  previewDataUrl.value = null;
  isGeneratingPreview.value = false;
  isCapturing.value = false;
  iframeKey.value += 1;
  previewGenerationId.value += 1;
  hasTriedAutoGenerate.value = false;

  const url = props.url?.trim();
  if (!url) return;
  if (!settingsStore.settings.enableSitePreviews) return;
  if (!isPreviewableHttpUrl(url)) return;

  const cached = await getSitePreviewFromCache(url);
  if (isDisposed.value) return;
  if (cached) {
    previewDataUrl.value = cached;
    return;
  }

  await maybeAutoGeneratePreview();
}

async function maybeAutoGeneratePreview() {
  if (!settingsStore.settings.enableSitePreviews) return;
  if (previewDataUrl.value) return;
  if (isGeneratingPreview.value) return;
  if (hasTriedAutoGenerate.value) return;
  if (!isCoverVisible.value) return;
  if (!isPreviewableHttpUrl(props.url)) return;

  hasTriedAutoGenerate.value = true;
  isGeneratingPreview.value = true;
  previewGenerationId.value += 1;
  iframeKey.value += 1;
}

async function handleIframeLoad() {
  if (!isGeneratingPreview.value) return;
  if (isCapturing.value) return;
  if (isDisposed.value) return;
  if (!isCoverVisible.value) {
    // 用户滚走了，不强行截图，避免裁剪错位
    isGeneratingPreview.value = false;
    hasTriedAutoGenerate.value = false;
    return;
  }

  const currentGenerationId = previewGenerationId.value;

  // 给页面一点点渲染时间，避免截到白屏
  await nextTick();
  await sleep(650);
  if (isDisposed.value) return;
  if (currentGenerationId !== previewGenerationId.value) return;
  if (!isCoverVisible.value) {
    isGeneratingPreview.value = false;
    hasTriedAutoGenerate.value = false;
    return;
  }

  const element = coverRef.value;
  if (!element) {
    isGeneratingPreview.value = false;
    return;
  }

  try {
    isCapturing.value = true;
    await nextTick();

    const dataUrl = await captureElementPreviewDataUrl(element, { maxWidth: 640, format: 'image/webp', quality: 0.82 });
    if (!dataUrl) return;

    const ok = await setSitePreviewToCache(props.url, dataUrl);
    if (!ok) return;

    previewDataUrl.value = dataUrl;
  } catch {
    // ignore
  } finally {
    isCapturing.value = false;
    isGeneratingPreview.value = false;
  }
}

function handleRefreshPreview() {
  if (!settingsStore.settings.enableSitePreviews) return;
  if (!props.url?.trim()) return;
  if (!isPreviewableHttpUrl(props.url)) return;
  if (isGeneratingPreview.value) return;

  previewDataUrl.value = null;
  isGeneratingPreview.value = true;
  previewGenerationId.value += 1;
  iframeKey.value += 1;
}

function sleep(ms: number): Promise<void> {
  const safe = Number.isFinite(ms) ? Math.max(0, Math.min(8000, ms)) : 0;
  return new Promise((resolve) => globalThis.setTimeout(resolve, safe));
}

function isPreviewableHttpUrl(url: string): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
</script>


