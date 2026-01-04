<template>
  <div class="min-h-full">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
      <div class="flex items-center gap-3">
        <div class="select-none text-base font-semibold text-slate-900 dark:text-slate-100">
          书签卡片
        </div>

        <a-input
          class="flex-1"
          ref="searchInputRef"
          v-model:value="searchQuery"
          allow-clear
          placeholder="搜索书签（标题 / 域名 / URL）"
          @keydown="handleSearchKeydown"
        />

        <a-button type="text" @click="isSettingsOpen = true">
          <template #icon>
            <SettingOutlined />
          </template>
        </a-button>
      </div>

      <div v-if="bookmarksStore.hasError" class="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div class="flex items-center justify-between gap-3">
          <div>{{ bookmarksStore.errorMessage || '书签读取失败' }}</div>
          <a-button size="small" :loading="bookmarksStore.isLoading" @click="handleRefresh">
            重试
          </a-button>
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <BreadcrumbNav
          v-if="!isSearchMode"
          :folders="bookmarksStore.breadcrumbFolders"
          :can-go-back="canGoBack"
          @navigate="bookmarksStore.goToFolder"
          @back="bookmarksStore.goToParentFolder"
        />

        <div class="text-xs text-slate-500 dark:text-slate-400">
          {{ lastUpdatedText }}
        </div>
      </div>

      <a-spin :spinning="bookmarksStore.isLoading && !bookmarksStore.isReady">
        <div v-if="isSearchMode" class="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div v-if="searchResults.length === 0" class="p-4 text-sm text-slate-500 dark:text-slate-400">
            未找到匹配结果
          </div>

            <a
            v-for="(item, index) in searchResults"
            :key="item.id"
            class="flex items-center gap-3 px-4 py-3 transition"
            :class="index === selectedIndex ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'"
            :href="item.url"
            :target="openTarget"
            rel="noopener noreferrer"
            :title="item.folderPath ? `${item.folderPath} / ${item.url}` : item.url"
            @mouseenter="selectedIndex = index"
          >
            <BookmarkAvatar :url="item.url" :title="item.title" :domain="item.domain" :size="32" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {{ item.title }}
              </div>
              <div class="truncate text-xs text-slate-500 dark:text-slate-400">
                {{ item.domain || item.url }}
                <span v-if="item.folderPath" class="ml-2 text-slate-400 dark:text-slate-500">
                  {{ item.folderPath }}
                </span>
              </div>
            </div>
          </a>
        </div>

        <div v-else>
          <div
            v-if="isCurrentFolderEmpty"
            class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            当前文件夹没有内容。你可以在书签栏添加常用网站，或在设置里切换入口文件夹。
          </div>

          <div v-else class="grid gap-3" :style="gridStyle">
            <FolderCard
              v-for="folder in bookmarksStore.currentFolders"
              :key="folder.id"
              :folder="folder"
              @open="bookmarksStore.goToFolder"
            />

            <BookmarkCard
              v-for="item in bookmarksStore.currentBookmarks"
              :key="item.id"
              :item="item"
              :target="openTarget"
            />
          </div>
        </div>
      </a-spin>
    </div>

    <SettingsDrawer v-model:open="isSettingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { SettingOutlined } from '@ant-design/icons-vue';
import { useDebounce, useEventListener } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import BookmarkAvatar from '@/components/bookmarks/bookmark-avatar.vue';
import BookmarkCard from '@/components/bookmarks/bookmark-card.vue';
import FolderCard from '@/components/bookmarks/folder-card.vue';
import BreadcrumbNav from '@/components/navigation/breadcrumb-nav.vue';
import SettingsDrawer from '@/components/settings/settings-drawer.vue';
import { searchBookmarkItems } from '@/services/bookmarks-search';
import { useBookmarksStore } from '@/stores/bookmarks-store';
import { useSettingsStore } from '@/stores/settings-store';
import { logError } from '@/utils/logger';

interface FocusableInput {
  focus: () => void;
}

const settingsStore = useSettingsStore();
const bookmarksStore = useBookmarksStore();

const isSettingsOpen = ref(false);
const searchInputRef = ref<FocusableInput | null>(null);

const searchQuery = ref('');
const debouncedSearchQuery = useDebounce(searchQuery, 120);
const trimmedSearchQuery = computed(() => searchQuery.value.trim());

const openTarget = computed(() => (settingsStore.settings.openBehavior === 'newTab' ? '_blank' : '_self'));

const isSearchMode = computed(() => trimmedSearchQuery.value.length > 0);

const searchResults = computed(() =>
  searchBookmarkItems(bookmarksStore.bookmarkItems, debouncedSearchQuery.value, 160)
);

const selectedIndex = ref(0);

const canGoBack = computed(() => bookmarksStore.breadcrumbFolders.length > 1);

const isCurrentFolderEmpty = computed(() => {
  return bookmarksStore.currentFolders.length === 0 && bookmarksStore.currentBookmarks.length === 0;
});

const gridStyle = computed(() => {
  // 先按用户设置渲染，范围由设置组件保证在 5~9
  const raw = Number(settingsStore.settings.cardsPerRow ?? 5);
  const cols = Number.isFinite(raw) ? Math.max(5, Math.min(9, Math.round(raw))) : 5;
  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
});

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

function focusSearchInput() {
  try {
    searchInputRef.value?.focus();
  } catch {
    // ignore
  }
}

function openUrl(url: string) {
  if (!url) return;
  if (settingsStore.settings.openBehavior === 'newTab') {
    const opened = window.open(url, '_blank', 'noopener');
    if (!opened) window.location.href = url;
    return;
  }
  window.location.href = url;
}

function openSelectedResult() {
  if (searchResults.value.length === 0) return;
  const safeIndex = Math.max(0, Math.min(searchResults.value.length - 1, selectedIndex.value));
  const item = searchResults.value[safeIndex];
  if (!item) return;
  openUrl(item.url);
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (!isSearchMode.value) return;

  if (event.key === 'ArrowDown') {
    if (searchResults.value.length === 0) return;
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, searchResults.value.length - 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    if (searchResults.value.length === 0) return;
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();
    openSelectedResult();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    searchQuery.value = '';
    selectedIndex.value = 0;
  }
}

async function handleRefresh() {
  await bookmarksStore.refreshFromChrome(settingsStore.settings.entryFolderId);
}

watch(searchResults, () => {
  selectedIndex.value = 0;
});

watch(
  () => settingsStore.settings.entryFolderId,
  (folderId) => {
    if (!bookmarksStore.isReady) return;
    bookmarksStore.setCurrentFolder(folderId);
  }
);

useEventListener(window, 'keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'k') {
    event.preventDefault();
    focusSearchInput();
  }
});

onMounted(() => {
  void initPage();
});

async function initPage() {
  try {
    if (!settingsStore.isReady) await settingsStore.initSettings();
    await bookmarksStore.bootstrap(settingsStore.settings.entryFolderId);
    await nextTick();
    focusSearchInput();
  } catch (error) {
    logError('页面初始化失败', error);
  }
}
</script>


