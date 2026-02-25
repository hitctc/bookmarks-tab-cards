<template>
  <a-drawer
    :open="open"
    title="设置"
    placement="right"
    width="380"
    @update:open="(val: boolean) => emit('update:open', val)"
  >
    <a-form layout="vertical">
      <a-form-item label="入口文件夹">
        <a-tree-select
          :value="settings.entryFolderId"
          :tree-data="folderTreeOptions"
          :disabled="folderTreeOptions.length === 0"
          placeholder="请选择入口文件夹"
          show-search
          tree-default-expand-all
          @change="handleEntryFolderChange"
        />
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          提示：入口文件夹用于默认展示；搜索会覆盖全部书签。
        </div>
      </a-form-item>

      <a-form-item label="主题">
        <a-select :value="settings.themeMode" :options="themeOptions" @change="handleThemeChange" />
      </a-form-item>

      <a-form-item label="打开方式">
        <a-select
          :value="settings.openBehavior"
          :options="openBehaviorOptions"
          @change="handleOpenBehaviorChange"
        />
      </a-form-item>

      <a-form-item label="每行卡片数量">
        <div class="flex items-center gap-3">
          <a-slider
            class="flex-1"
            :min="2"
            :max="9"
            :step="1"
            :value="settings.cardsPerRow"
            @change="handleCardsPerRowChange"
          />
          <div class="w-10 text-right text-sm text-slate-700 dark:text-slate-200">
            {{ settings.cardsPerRow }}
          </div>
        </div>
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          建议范围：5~6 更舒适；数值越大卡片越小。
        </div>
      </a-form-item>

    </a-form>

    <a-divider />

    <div class="flex items-center justify-between gap-3">
      <a-button :loading="bookmarksStore.isLoading" @click="handleRefreshBookmarks">刷新书签</a-button>
      <div class="text-xs text-slate-500 dark:text-slate-400">
        {{ lastUpdatedText }}
      </div>
    </div>

    <div class="mt-3">
      <a-button
        :loading="isCheckingDuplicates"
        :disabled="bookmarksStore.bookmarkItems.length === 0"
        @click="handleCheckDuplicateBookmarks"
      >
        检查重复书签
      </a-button>
      <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
        范围：全部书签（{{ bookmarksStore.bookmarkItems.length }} 条）
      </div>
    </div>

    <div
      v-if="duplicateCheckResult"
      class="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900"
    >
      <div class="text-xs text-slate-500 dark:text-slate-400">
        检查于 {{ formatDateTime(duplicateCheckResult.checkedAt) }}
      </div>
      <div class="mt-1 text-sm text-slate-700 dark:text-slate-200">
        名称重复组 {{ duplicateCheckResult.titleGroups.length }}，地址重复组 {{ duplicateCheckResult.urlGroups.length }}
      </div>

      <div
        v-if="duplicateCheckResult.titleGroups.length === 0 && duplicateCheckResult.urlGroups.length === 0"
        class="mt-2 text-xs text-emerald-600 dark:text-emerald-400"
      >
        未发现重复书签
      </div>

      <div v-if="duplicateCheckResult.titleGroups.length > 0" class="mt-3">
        <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">名称重复（点击名称复制）</div>
        <div class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
          <div
            v-for="group in displayedTitleDuplicateGroups"
            :key="`title-${group.groupKey}`"
            class="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <div class="flex items-start justify-between gap-2">
              <button
                type="button"
                class="text-left text-xs font-medium text-slate-700 underline-offset-2 transition hover:text-sky-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-200 dark:hover:text-sky-400 dark:focus-visible:ring-offset-slate-950"
                :title="`点击复制名称：${group.displayValue}`"
                @click="handleCopyDuplicateTitle(group.displayValue)"
              >
                {{ group.displayValue }}
              </button>
              <div class="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                {{ group.items.length }} 条
              </div>
            </div>
            <div class="mt-1 space-y-1">
              <div v-for="item in group.items" :key="item.id" class="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                <div class="break-all whitespace-normal">路径：{{ item.folderPath || '根目录' }}</div>
                <div class="break-all whitespace-normal">地址：{{ item.url }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hiddenTitleGroupCount > 0" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          还有 {{ hiddenTitleGroupCount }} 组未展示
        </div>
      </div>

      <div v-if="duplicateCheckResult.urlGroups.length > 0" class="mt-3">
        <div class="text-xs font-semibold text-slate-700 dark:text-slate-200">地址重复（点击地址复制）</div>
        <div class="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
          <div
            v-for="group in displayedUrlDuplicateGroups"
            :key="`url-${group.groupKey}`"
            class="rounded-md border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-950"
          >
            <div class="flex items-start justify-between gap-2">
              <button
                type="button"
                class="text-left text-xs font-medium text-slate-700 underline-offset-2 transition hover:text-sky-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-200 dark:hover:text-sky-400 dark:focus-visible:ring-offset-slate-950"
                :title="`点击复制地址：${group.displayValue}`"
                @click="handleCopyDuplicateUrl(group.displayValue)"
              >
                {{ group.displayValue }}
              </button>
              <div class="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                {{ group.items.length }} 条
              </div>
            </div>
            <div class="mt-1 space-y-1">
              <div v-for="item in group.items" :key="item.id" class="text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                <div class="break-all whitespace-normal">路径：{{ item.folderPath || '根目录' }}</div>
                <div class="break-all whitespace-normal">名称：{{ item.title || '(空标题)' }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="hiddenUrlGroupCount > 0" class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          还有 {{ hiddenUrlGroupCount }} 组未展示
        </div>
      </div>
    </div>

    <a-divider />

    <div class="text-xs leading-6 text-slate-500 dark:text-slate-400">
      <div>权限：bookmarks、storage。</div>
      <div>隐私：插件不采集、不上传任何数据；页面不加载目标站点页面内容。</div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { message } from 'ant-design-vue';

import { useBookmarksStore } from '@/stores/bookmarks-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { BookmarkIndexItem } from '@/types/bookmarks';
import type { OpenBehavior, ThemeMode } from '@/types/settings';
import { normalizeSearchText } from '@/utils/text';

defineProps<{ open: boolean }>();

const emit = defineEmits<{
  (event: 'update:open', value: boolean): void;
}>();

const settingsStore = useSettingsStore();
const bookmarksStore = useBookmarksStore();

const settings = computed(() => settingsStore.settings);
const folderTreeOptions = computed(() => bookmarksStore.folderTreeOptions);

const themeOptions = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
];

const openBehaviorOptions = [
  { value: 'currentTab', label: '当前标签打开' },
  { value: 'newTab', label: '新标签打开' },
];

interface DuplicateBookmarkGroup {
  groupKey: string;
  displayValue: string;
  items: BookmarkIndexItem[];
}

interface DuplicateCheckResult {
  checkedAt: number;
  titleGroups: DuplicateBookmarkGroup[];
  urlGroups: DuplicateBookmarkGroup[];
}

const MAX_DISPLAY_GROUPS = 20;
const isCheckingDuplicates = ref(false);
const duplicateCheckResult = ref<DuplicateCheckResult | null>(null);

const lastUpdatedText = computed(() => {
  const ts = bookmarksStore.lastUpdatedAt;
  if (!ts) return '未更新';
  return `更新于 ${formatDateTime(ts)}`;
});

const displayedTitleDuplicateGroups = computed(() => {
  if (!duplicateCheckResult.value) return [];
  return duplicateCheckResult.value.titleGroups.slice(0, MAX_DISPLAY_GROUPS);
});

const displayedUrlDuplicateGroups = computed(() => {
  if (!duplicateCheckResult.value) return [];
  return duplicateCheckResult.value.urlGroups.slice(0, MAX_DISPLAY_GROUPS);
});

const hiddenTitleGroupCount = computed(() => {
  if (!duplicateCheckResult.value) return 0;
  return Math.max(0, duplicateCheckResult.value.titleGroups.length - displayedTitleDuplicateGroups.value.length);
});

const hiddenUrlGroupCount = computed(() => {
  if (!duplicateCheckResult.value) return 0;
  return Math.max(0, duplicateCheckResult.value.urlGroups.length - displayedUrlDuplicateGroups.value.length);
});

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

async function handleEntryFolderChange(value: unknown) {
  const folderId = String(value || '');
  if (!folderId) return;
  await settingsStore.updateSettings({ entryFolderId: folderId });
}

async function handleThemeChange(value: unknown) {
  const themeMode = String(value) as ThemeMode;
  await settingsStore.updateSettings({ themeMode });
}

async function handleOpenBehaviorChange(value: unknown) {
  const openBehavior = String(value) as OpenBehavior;
  await settingsStore.updateSettings({ openBehavior });
}

async function handleCardsPerRowChange(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return;
  await settingsStore.updateSettings({ cardsPerRow: next });
}

async function handleRefreshBookmarks() {
  await bookmarksStore.refreshFromChrome(settingsStore.settings.entryFolderId);
}

function normalizeBookmarkUrlForDuplicate(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  // 地址重复按“完整字符串完全一致”判断：子域名、路径、查询参数、hash 都必须一致。
  return trimmed;
}

function buildDuplicateGroups(
  items: BookmarkIndexItem[],
  getGroupKey: (item: BookmarkIndexItem) => string,
  getDisplayValue: (item: BookmarkIndexItem) => string
): DuplicateBookmarkGroup[] {
  const groupMap = new Map<string, DuplicateBookmarkGroup>();

  for (const item of items) {
    const groupKey = getGroupKey(item);
    if (!groupKey) continue;

    const existing = groupMap.get(groupKey);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groupMap.set(groupKey, {
      groupKey,
      displayValue: getDisplayValue(item),
      items: [item],
    });
  }

  return Array.from(groupMap.values())
    .filter((group) => group.items.length > 1)
    .sort((a, b) => b.items.length - a.items.length || a.displayValue.localeCompare(b.displayValue, 'zh-Hans-CN'));
}

async function handleCheckDuplicateBookmarks() {
  isCheckingDuplicates.value = true;
  try {
    // 让 loading 状态先渲染，避免大量书签时按钮点击无反馈
    await Promise.resolve();
    const allItems = bookmarksStore.bookmarkItems;

    const titleGroups = buildDuplicateGroups(
      allItems,
      (item) => normalizeSearchText(item.title),
      (item) => item.title.trim() || '(空标题)'
    );

    const urlGroups = buildDuplicateGroups(
      allItems,
      (item) => normalizeBookmarkUrlForDuplicate(item.url),
      (item) => item.url.trim() || '(空地址)'
    );

    duplicateCheckResult.value = {
      checkedAt: Date.now(),
      titleGroups,
      urlGroups,
    };
  } finally {
    isCheckingDuplicates.value = false;
  }
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback to execCommand
  }

  try {
    if (!globalThis.document?.body) return false;
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

async function handleCopyDuplicateTitle(title: string) {
  const value = title.trim();
  if (!value) {
    message.warning('名称为空，无法复制');
    return;
  }

  const ok = await copyTextToClipboard(value);
  if (ok) {
    message.success('已复制名称');
    return;
  }
  message.error('复制失败，请手动复制');
}

async function handleCopyDuplicateUrl(url: string) {
  const value = url.trim();
  if (!value) {
    message.warning('地址为空，无法复制');
    return;
  }

  const ok = await copyTextToClipboard(value);
  if (ok) {
    message.success('已复制地址');
    return;
  }
  message.error('复制失败，请手动复制');
}
</script>
