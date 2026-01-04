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

      <a-form-item label="站点预览图">
        <a-select
          :value="settings.enableSitePreviews ? 'on' : 'off'"
          :options="sitePreviewOptions"
          @change="handleSitePreviewChange"
        />
        <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">
          开启后会在卡片 16:9 区域加载网页并生成截图缓存；你也可以在卡片右上角手动刷新单张预览图。
        </div>
      </a-form-item>

      <a-form-item label="每行卡片数量">
        <div class="flex items-center gap-3">
          <a-slider
            class="flex-1"
            :min="5"
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

    <a-divider />

    <div class="text-xs leading-6 text-slate-500 dark:text-slate-400">
      <div>权限：bookmarks、storage、tabs（生成预览图时用于截图）。</div>
      <div>隐私：插件不采集、不上传任何数据；开启预览图时会访问目标站点并把截图缓存到本地。</div>
    </div>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { useBookmarksStore } from '@/stores/bookmarks-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { OpenBehavior, ThemeMode } from '@/types/settings';

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

const sitePreviewOptions = [
  { value: 'on', label: '开启（生成预览图）' },
  { value: 'off', label: '关闭（仅显示 favicon）' },
];

const lastUpdatedText = computed(() => {
  const ts = bookmarksStore.lastUpdatedAt;
  if (!ts) return '未更新';
  return `更新于 ${formatDateTime(ts)}`;
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

async function handleSitePreviewChange(value: unknown) {
  const enableSitePreviews = String(value) === 'on';
  await settingsStore.updateSettings({ enableSitePreviews });
}

async function handleCardsPerRowChange(value: unknown) {
  const next = Number(value);
  if (!Number.isFinite(next)) return;
  await settingsStore.updateSettings({ cardsPerRow: next });
}

async function handleRefreshBookmarks() {
  await bookmarksStore.refreshFromChrome(settingsStore.settings.entryFolderId);
}
</script>


