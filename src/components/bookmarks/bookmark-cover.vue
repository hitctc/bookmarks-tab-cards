<template>
  <div class="relative h-full w-full overflow-hidden" :style="pseudoCoverStyle">
    <div class="absolute inset-0 bg-gradient-to-b from-black/8 via-black/14 to-black/45" />

    <div class="absolute left-2 top-2">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-md bg-white/85 shadow-md ring-1 ring-black/10 backdrop-blur-sm"
        aria-hidden="true"
      >
        <img
          v-if="!hasFaviconError"
          class="h-5 w-5"
          :src="faviconUrl"
          :alt="title"
          @load="handleFaviconLoad"
          @error="handleFaviconError"
        />
        <span v-else class="text-[11px] font-bold text-slate-700">
          {{ pseudoFallbackLetter }}
        </span>
      </div>
    </div>

    <div v-if="siteBadgeText" class="absolute left-12 top-2">
      <div
        class="inline-flex max-w-[92px] items-center rounded bg-black/34 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white/90 backdrop-blur-sm"
        :title="siteBadgeText"
      >
        <span class="truncate">{{ siteBadgeText }}</span>
      </div>
    </div>

    <div class="absolute inset-x-0 bottom-0 p-0">
      <div class="rounded-md bg-white/14 px-2 py-1.5">
        <div class="poster-title min-w-0 flex-1 text-xs font-semibold text-white">
          <template v-for="(segment, index) in highlightedTitleSegments" :key="`${segment.text}-${index}`">
            <mark
              v-if="segment.isMatch"
              class="rounded bg-amber-200/90 px-0.5 text-slate-900 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
            >
              {{ segment.text }}
            </mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </div>
        <div v-if="displayUrl" class="mt-0.5 truncate text-[10px] leading-4 text-white/80" :title="displayUrl">
          {{ displayUrl }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { buildSmartPseudoCoverStyle, resolveSiteCoverAdapter } from '@/services/bookmark-preview-service';
import { getDomainFromUrl, getFaviconFallbackUrls } from '@/utils/url';

const GRADIENT_CACHE_MAX = 400;
const faviconGradientCache = new Map<string, Record<string, string>>();

const props = defineProps<{
  url: string;
  title: string;
  highlightQuery?: string;
}>();

const faviconIndex = ref(0);

// 64px 在 chrome://favicon* 里兼容性更好，同时足够清晰
const faviconCandidates = computed(() => getFaviconFallbackUrls(props.url, 64));

const faviconUrl = computed(() => faviconCandidates.value[faviconIndex.value] || '');

const hasFaviconError = computed(() => !faviconUrl.value);

const domain = computed(() => getDomainFromUrl(props.url));

const siteAdapter = computed(() => resolveSiteCoverAdapter(props.url));

const pseudoSeed = computed(() => {
  return (domain.value || props.title || props.url || '').trim();
});

const siteBadgeText = computed(() => siteAdapter.value?.badgeText || '');

const pseudoFallbackLetter = computed(() => {
  const adapterLetter = siteAdapter.value?.fallbackLetter?.trim();
  if (adapterLetter) return adapterLetter;

  const text = (domain.value || props.title || '?').trim();
  return (text[0] || '?').toUpperCase();
});

watch(
  () => props.url,
  () => {
    faviconIndex.value = 0;
    logoCoverStyle.value = null;

    if (!siteAdapter.value) {
      const cached = faviconGradientCache.get(getGradientCacheKey(props.url));
      if (cached) logoCoverStyle.value = cached;
    }
  }
);

const pseudoPosterTitle = computed(() => {
  const t = (props.title || '').trim();
  if (t) return t;

  const adapterSubtitle = (siteAdapter.value?.subtitle || '').trim();
  if (adapterSubtitle) return adapterSubtitle;

  const d = (domain.value || '').trim();
  if (d) return d;

  return (props.url || '').trim();
});

const displayUrl = computed(() => {
  const adapterSubtitle = (siteAdapter.value?.subtitle || '').trim();
  if (adapterSubtitle) return adapterSubtitle;

  return (domain.value || '').trim();
});

interface HighlightSegment {
  text: string;
  isMatch: boolean;
}

const highlightedTitleSegments = computed<HighlightSegment[]>(() =>
  buildHighlightSegments(pseudoPosterTitle.value, props.highlightQuery || '')
);

const logoCoverStyle = ref<Record<string, string> | null>(null);

const pseudoCoverStyle = computed(() => {
  if (siteAdapter.value) return siteAdapter.value.coverStyle;
  return logoCoverStyle.value ?? buildSmartPseudoCoverStyle(pseudoSeed.value);
});

function handleFaviconError() {
  if (siteAdapter.value) return;

  faviconIndex.value += 1;
  // 所有候选都失败后才会走标题兜底，这里留一个日志方便排查
  if (faviconIndex.value >= faviconCandidates.value.length) {
    // eslint-disable-next-line no-console
    console.warn('[书签卡片] favicon 加载失败', { url: props.url, candidates: faviconCandidates.value });
  }
}

function handleFaviconLoad(event: Event) {
  if (siteAdapter.value) return;

  // 已有颜色（缓存/已取色）就不重复计算
  if (logoCoverStyle.value) return;

  const cacheKey = getGradientCacheKey(props.url);
  const cached = faviconGradientCache.get(cacheKey);
  if (cached) {
    logoCoverStyle.value = cached;
    return;
  }

  const img = event.target as HTMLImageElement | null;
  if (!img) return;

  scheduleIdleTask(() => {
    // 可能已被切换 URL/卸载，这里再做一次短路判断
    if (logoCoverStyle.value) return;

    const extracted = extractGradientStyleFromLogo(img);
    if (!extracted) return;

    faviconGradientCache.set(cacheKey, extracted);
    pruneGradientCache();
    logoCoverStyle.value = extracted;
  });
}

function scheduleIdleTask(task: () => void) {
  try {
    const ric = (globalThis as any).requestIdleCallback;
    if (typeof ric === 'function') {
      ric(task, { timeout: 800 });
      return;
    }
  } catch {
    // ignore
  }

  globalThis.setTimeout(task, 0);
}

function pruneGradientCache() {
  if (faviconGradientCache.size <= GRADIENT_CACHE_MAX) return;
  const firstKey = faviconGradientCache.keys().next().value as string | undefined;
  if (firstKey) faviconGradientCache.delete(firstKey);
}

function getGradientCacheKey(url: string): string {
  const d = getDomainFromUrl(url);
  return d || url;
}

function extractGradientStyleFromLogo(img: HTMLImageElement): Record<string, string> | null {
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);

    let data: Uint8ClampedArray;
    try {
      data = ctx.getImageData(0, 0, size, size).data;
    } catch {
      // 典型原因：跨域图片导致 canvas 被污染，无法读取像素
      return null;
    }

    const colors = pickTwoDominantHslColors(data);
    if (!colors) return null;

    const c1 = normalizeHslForGradient(colors.c1);
    const c2 = normalizeHslForGradient(colors.c2);

    return {
      backgroundImage: `linear-gradient(135deg, ${toCssHsl(c1)}, ${toCssHsl(c2)})`,
    };
  } catch {
    return null;
  }
}

interface HslColor {
  h: number; // 0~360
  s: number; // 0~1
  l: number; // 0~1
}

function pickTwoDominantHslColors(data: Uint8ClampedArray): { c1: HslColor; c2: HslColor } | null {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();

  function addPixel(r: number, g: number, b: number) {
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
      return;
    }
    buckets.set(key, { count: 1, r, g, b });
  }

  // 第一遍：排除“接近白/接近黑”的像素，避免被背景吞没
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0;
    if (a < 32) continue;
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;

    const isNearWhite = r > 245 && g > 245 && b > 245;
    const isNearBlack = r < 10 && g < 10 && b < 10;
    if (isNearWhite || isNearBlack) continue;

    addPixel(r, g, b);
  }

  // 如果过滤后没颜色，再放宽条件（例如 GitHub 这类黑白 logo）
  if (buckets.size === 0) {
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 0;
      if (a < 32) continue;
      addPixel(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    }
  }

  if (buckets.size === 0) return null;

  const sorted = Array.from(buckets.values()).sort((a, b) => b.count - a.count);
  const top = sorted[0];
  if (!top) return null;

  const c1Rgb = {
    r: Math.round(top.r / top.count),
    g: Math.round(top.g / top.count),
    b: Math.round(top.b / top.count),
  };
  const c1 = rgbToHsl(c1Rgb.r, c1Rgb.g, c1Rgb.b);

  let c2: HslColor | null = null;
  for (let i = 1; i < Math.min(sorted.length, 12); i += 1) {
    const item = sorted[i];
    if (!item) continue;
    const rgb = {
      r: Math.round(item.r / item.count),
      g: Math.round(item.g / item.count),
      b: Math.round(item.b / item.count),
    };
    const cand = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hueDiff = minHueDiff(c1.h, cand.h);
    if (hueDiff >= 18 || Math.abs(c1.l - cand.l) >= 0.12) {
      c2 = cand;
      break;
    }
  }

  if (!c2) {
    c2 = {
      h: (c1.h + 20) % 360,
      s: clamp01(c1.s * 0.85),
      l: clamp01(c1.l - 0.1),
    };
  }

  // 过灰的颜色会很闷，这种情况宁可回退到哈希渐变
  if (c1.s < 0.08) return null;
  return { c1, c2 };
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
  const rr = clamp01(r / 255);
  const gg = clamp01(g / 255);
  const bb = clamp01(b / 255);

  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rr:
        h = ((gg - bb) / delta) % 6;
        break;
      case gg:
        h = (bb - rr) / delta + 2;
        break;
      default:
        h = (rr - gg) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: clamp01(s), l: clamp01(l) };
}

function normalizeHslForGradient(input: HslColor): HslColor {
  // 控制为中性色范围，避免高饱和导致“炸眼”
  const h = clamp(input.h, 0, 360);
  const s = clamp(input.s * 0.72, 0.16, 0.46);
  const l = clamp(input.l + 0.02, 0.34, 0.62);
  return { h, s, l };
}

function toCssHsl(color: HslColor): string {
  const h = Math.round(clamp(color.h, 0, 360));
  const s = Math.round(clamp01(color.s) * 100);
  const l = Math.round(clamp01(color.l) * 100);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function minHueDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function buildHighlightSegments(text: string, rawKeyword: string): HighlightSegment[] {
  if (!text) return [];

  const keywords = parseHighlightKeywords(rawKeyword);
  if (keywords.length === 0) {
    return [{ text, isMatch: false }];
  }

  const escaped = keywords.map(escapeRegExp);
  if (escaped.length === 0) {
    return [{ text, isMatch: false }];
  }

  const matcher = new RegExp(`(${escaped.join('|')})`, 'ig');
  const lowerKeywordSet = new Set(keywords.map((item) => item.toLowerCase()));

  return text
    .split(matcher)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isMatch: lowerKeywordSet.has(part.toLowerCase()),
    }));
}

function parseHighlightKeywords(rawKeyword: string): string[] {
  const parts = (rawKeyword || '')
    .trim()
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length === 0) return [];

  // 长关键词优先，避免短词提前匹配吞掉更长的高亮片段
  parts.sort((a, b) => b.length - a.length);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    deduped.push(part);
  }
  return deduped;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
</script>

<style scoped>
.poster-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
