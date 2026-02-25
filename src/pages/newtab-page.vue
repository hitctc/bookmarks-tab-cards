<template>
  <div class="min-h-full">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-4 p-4">
      <div class="flex items-center gap-3">
        <button
          class="select-none text-base font-semibold text-slate-900 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-100 dark:hover:text-slate-200 dark:focus-visible:ring-offset-slate-950"
          type="button"
          title="回到初始状态"
          @click="resetToInitialState"
        >
          书签卡片
        </button>

        <a-input
          class="flex-1"
          ref="searchInputRef"
          v-model:value="searchQuery"
          allow-clear
          :placeholder="searchPlaceholder"
          @keydown="handleSearchKeydown"
        />

        <a-button type="text" title="打开设置" aria-label="打开设置" @click="isSettingsOpen = true">
          <template #icon>
            <SettingOutlined />
          </template>
        </a-button>
        <a-button type="text" title="打开书签管理器" aria-label="打开书签管理器" @click="handleOpenBookmarksManager">
          <template #icon>
            <BookOutlined />
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
        <div v-if="isSearchMode">
          <div
            v-if="searchResults.length === 0"
            class="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
          >
            未找到匹配结果
          </div>

          <div v-else class="grid items-start gap-3" :style="gridStyle">
            <div
              v-for="(item, index) in searchResults"
              :key="item.id"
              class="rounded-xl transition-shadow"
              :class="
                index === selectedIndex
                  ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white dark:ring-sky-400 dark:ring-offset-slate-950'
                  : ''
              "
              @mouseenter="selectedIndex = index"
            >
              <BookmarkCard :item="item" :target="openTarget" :highlight-query="debouncedTrimmedSearchQuery" />
            </div>
          </div>
        </div>

        <div v-else>
          <div
            v-if="isCurrentFolderEmpty"
            class="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            当前文件夹没有内容。你可以在书签栏添加常用网站，或在设置里切换入口文件夹。
          </div>

          <div v-else class="grid items-start gap-3" :style="gridStyle">
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
import { BookOutlined, SettingOutlined } from '@ant-design/icons-vue';
import { useDebounce, useEventListener } from '@vueuse/core';
import { computed, nextTick, onMounted, ref, watch } from 'vue';

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
const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform || '');
const SEARCH_FOCUS_SHORTCUT_LABEL = isMacPlatform ? 'Cmd + K' : 'Ctrl + K';

const isSettingsOpen = ref(false);
const searchInputRef = ref<FocusableInput | null>(null);

const searchQuery = ref('');
const searchPlaceholder = `搜索书签（标题 / 域名 / URL，${SEARCH_FOCUS_SHORTCUT_LABEL} 聚焦）`;
const debouncedSearchQuery = useDebounce(searchQuery, 120);
const trimmedSearchQuery = computed(() => searchQuery.value.trim());
const debouncedTrimmedSearchQuery = computed(() => debouncedSearchQuery.value.trim());

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
  // 先按用户设置渲染，范围由设置组件保证在 2~9
  const raw = Number(settingsStore.settings.cardsPerRow ?? 5);
  const cols = Number.isFinite(raw) ? Math.max(2, Math.min(9, Math.round(raw))) : 5;
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

function isScrolledToBottom(): boolean {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const viewportHeight = window.innerHeight || doc.clientHeight || 0;
  const scrollHeight = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
  const remaining = scrollHeight - (scrollTop + viewportHeight);
  return remaining <= 2;
}

function handleFocusSearchShortcut() {
  if (isScrolledToBottom()) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  focusSearchInput();
}

function resetToInitialState() {
  searchQuery.value = '';
  selectedIndex.value = 0;
  isSettingsOpen.value = false;
  bookmarksStore.setCurrentFolder(settingsStore.settings.entryFolderId);
  focusSearchInput();
}

async function handleOpenBookmarksManager() {
  const managerUrl = 'chrome://bookmarks/';
  const openedByApi = await openInExtensionTab(managerUrl);
  if (openedByApi) return;

  const opened = window.open(managerUrl, '_blank', 'noopener');
  if (opened) return;
  window.location.href = managerUrl;
}

async function openInExtensionTab(url: string): Promise<boolean> {
  const tabsApi = globalThis.chrome?.tabs;
  if (!tabsApi?.create) return false;

  try {
    return await new Promise<boolean>((resolve) => {
      tabsApi.create({ url }, () => {
        const runtimeError = globalThis.chrome?.runtime?.lastError;
        if (runtimeError) {
          logError('打开书签管理器失败（tabs.create）', runtimeError.message);
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  } catch (error) {
    logError('打开书签管理器失败（tabs.create）', error);
    return false;
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
  // 用 event.code 识别物理按键位，避免不同布局/输入法导致的 event.key 差异。
  const isModifierMatched = isMacPlatform
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  const isSearchFocusShortcut =
    isModifierMatched && !event.altKey && !event.shiftKey && event.code === 'KeyK';
  if (isSearchFocusShortcut) {
    event.preventDefault();
    handleFocusSearchShortcut();
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
