<template>
  <div class="editorial-page min-h-full">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 md:p-6">
      <div class="editorial-toolbar flex items-center gap-3">
        <button
          class="editorial-title-button select-none text-base font-semibold text-slate-900 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e6f4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-100 dark:hover:text-slate-200 dark:focus-visible:ring-offset-slate-950"
          type="button"
          title="回到初始状态"
          @click="resetToInitialState"
        >
          书签卡片
        </button>

        <a-input
          class="editorial-search h-10 flex-1"
          size="large"
          ref="searchInputRef"
          v-model:value="searchQuery"
          allow-clear
          :placeholder="searchPlaceholder"
          @keydown="handleSearchKeydown"
        />

        <a-button
          type="text"
          size="large"
          class="editorial-icon-button !inline-flex !h-10 !w-10 !min-w-0 !items-center !justify-center !rounded-lg !p-0 text-slate-600 hover:!bg-slate-100 hover:!text-slate-900 dark:text-slate-300 dark:hover:!bg-slate-800 dark:hover:!text-slate-100"
          title="打开设置"
          aria-label="打开设置"
          @click="isSettingsOpen = true"
        >
          <template #icon>
            <SettingOutlined class="text-[18px]" />
          </template>
        </a-button>
        <a-button
          type="text"
          size="large"
          class="editorial-icon-button !inline-flex !h-10 !w-10 !min-w-0 !items-center !justify-center !rounded-lg !p-0 text-slate-600 hover:!bg-slate-100 hover:!text-slate-900 dark:text-slate-300 dark:hover:!bg-slate-800 dark:hover:!text-slate-100"
          title="打开书签管理器"
          aria-label="打开书签管理器"
          @click="handleOpenBookmarksManager"
        >
          <template #icon>
            <BookOutlined class="text-[18px]" />
          </template>
        </a-button>
      </div>

      <div
        v-if="bookmarksStore.hasError"
        class="editorial-danger rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
      >
        <div class="flex items-center justify-between gap-3">
          <div>{{ bookmarksStore.errorMessage || '书签读取失败' }}</div>
          <a-button size="small" :loading="bookmarksStore.isLoading" @click="handleRefresh">
            重试
          </a-button>
        </div>
      </div>

      <div class="editorial-meta-row flex items-center justify-between gap-3">
        <BreadcrumbNav
          v-if="!isSearchMode"
          :folders="bookmarksStore.breadcrumbFolders"
          :can-go-back="canGoBack"
          @navigate="bookmarksStore.goToFolder"
          @back="bookmarksStore.goToParentFolder"
        />

        <div class="editorial-muted-text text-xs text-slate-500 dark:text-slate-400">
          {{ lastUpdatedText }}
        </div>
      </div>

      <a-spin :spinning="bookmarksStore.isLoading && !bookmarksStore.isReady" class="editorial-main">
        <div v-if="isSearchMode">
          <div class="editorial-hint mb-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            仅支持 {{ SEARCH_OPEN_IN_NEW_TAB_SHORTCUT_LABEL }} 新标签打开
          </div>

          <div
            v-if="searchResults.length === 0"
            class="editorial-empty-surface rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
          >
            未找到匹配结果
          </div>

          <div
            v-else-if="isSearchListView"
            class="editorial-list-surface overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <div
              v-for="(item, index) in visibleSearchResults"
              :key="item.id"
              class="editorial-list-item group relative border-b border-slate-200 px-3 py-2 transition-colors duration-150 last:border-b-0 dark:border-slate-800"
              :class="
                index === selectedIndex
                  ? 'bg-amber-50/85 ring-1 ring-inset ring-[#8e6f4f]/30 dark:bg-[#372d23]/45 dark:ring-[#c9b08a]/35'
                  : 'hover:bg-[#f6f1ea] hover:ring-1 hover:ring-inset hover:ring-[#bca487]/45 dark:hover:bg-[#2b241d] dark:hover:ring-[#6e5b49]/60'
              "
            >
              <div
                class="pointer-events-none absolute inset-y-1 left-0 w-1 rounded-r transition-opacity duration-150"
                :class="
                  index === selectedIndex
                    ? 'bg-[#8e6f4f] opacity-100 dark:bg-[#c9b08a]'
                    : 'bg-[#bca487] opacity-0 group-hover:opacity-100 dark:bg-[#7c6752]'
                "
              />
              <a
                :href="item.url"
                :target="openTarget"
                rel="noopener noreferrer"
                class="flex items-start gap-3 pr-20"
                :title="item.url"
                @click="handleBookmarkOpen(item)"
              >
                <BookmarkAvatar :url="item.url" :title="item.title" :domain="item.domain" :size="28" />
                <div class="min-w-0 flex-1">
                  <div class="flex min-w-0 items-center gap-2">
                    <div class="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{{ item.title }}</div>
                    <span
                      v-if="bookmarksStore.isBookmarkPinned(item.id)"
                      class="inline-flex h-5 shrink-0 items-center gap-1 rounded bg-[#f0e5d8] px-1.5 text-[10px] font-medium text-[#74563b] dark:bg-[#4b3c30]/55 dark:text-[#e0c8aa]"
                    >
                      <PushpinFilled class="text-[10px]" />
                      <span>置顶</span>
                    </span>
                  </div>
                  <div class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                    {{ item.domain || item.url }}
                  </div>
                  <div class="mt-0.5 pr-12 text-[11px]">
                    <span class="block truncate text-slate-400 dark:text-slate-500">
                      {{ item.folderPath || '根目录' }}
                    </span>
                  </div>
                </div>
              </a>

              <span
                v-if="settingsStore.settings.showOpenCount"
                class="pointer-events-none absolute bottom-2 right-3 z-[1] tabular-nums text-[11px] text-slate-500 dark:text-slate-400"
                :title="`打开次数：${getBookmarkOpenCount(item.id)}`"
              >
                {{ getBookmarkOpenCount(item.id) }}
              </span>

              <div
                class="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1 transition-opacity duration-150"
                :class="
                  index === selectedIndex
                    ? 'pointer-events-auto opacity-100'
                    : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100'
                "
              >
                <button
                  type="button"
                  :title="bookmarksStore.isBookmarkPinned(item.id) ? '取消置顶' : '置顶书签'"
                  :aria-label="bookmarksStore.isBookmarkPinned(item.id) ? '取消置顶' : '置顶书签'"
                  class="inline-flex h-7 items-center justify-center rounded-md shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e6f4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
                  :class="
                    bookmarksStore.isBookmarkPinned(item.id)
                      ? 'gap-1 bg-[#f0e5d8]/95 px-2 text-[#74563b] dark:bg-[#4b3c30]/55 dark:text-[#e0c8aa]'
                      : 'w-7 bg-white/92 text-slate-700 hover:bg-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900'
                  "
                  @click="handleSearchListTogglePin(item, $event)"
                >
                  <template v-if="bookmarksStore.isBookmarkPinned(item.id)">
                    <PushpinFilled />
                    <span class="text-[11px] font-medium leading-none">置顶</span>
                  </template>
                  <PushpinOutlined v-else />
                </button>

                <button
                  type="button"
                  title="编辑书签"
                  aria-label="编辑书签"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/92 text-slate-700 shadow-sm ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e6f4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
                  @click="handleSearchListEdit(item, $event)"
                >
                  <EditOutlined />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="grid items-start gap-3" :style="gridStyle">
            <div
              v-for="(item, index) in visibleSearchResults"
              :key="item.id"
              class="rounded-xl transition-shadow duration-300"
              :class="
                index === selectedIndex
                  ? 'ring-2 ring-[#8e6f4f] ring-offset-2 ring-offset-white dark:ring-[#c9b08a] dark:ring-offset-slate-950'
                  : ''
              "
            >
              <BookmarkCard
                :item="item"
                :target="openTarget"
                :highlight-query="debouncedTrimmedSearchQuery"
                @edit="handleStartEditBookmark"
                :is-pinned="bookmarksStore.isBookmarkPinned(item.id)"
                :open-count="getBookmarkOpenCount(item.id)"
                :show-open-count="settingsStore.settings.showOpenCount"
                @toggle-pin="handleToggleBookmarkPin"
                @open="handleBookmarkOpen"
              />
            </div>
          </div>

          <div
            v-if="searchResults.length > visibleSearchResults.length"
            class="editorial-muted-text mt-2 px-1 text-xs text-slate-500 dark:text-slate-400"
          >
            先显示 {{ visibleSearchResults.length }} 条，共 {{ searchResults.length }} 条结果…
          </div>
        </div>

        <div v-else>
          <div
            v-if="isCurrentFolderEmpty"
            class="editorial-empty-surface rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <div>当前文件夹没有内容。你可以在书签栏添加常用网站，或在设置里切换入口文件夹。</div>
            <div class="mt-3 flex flex-wrap gap-2">
              <a-button size="small" @click="handleOpenBookmarksManager">打开书签管理器</a-button>
              <a-button size="small" @click="isSettingsOpen = true">切换入口文件夹</a-button>
            </div>
          </div>

          <div v-else class="space-y-6">
            <section v-if="isHomeFolder && homepageRecentBookmarks.length > 0" class="space-y-2">
              <div class="editorial-section-title px-1 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400">
                最近打开
              </div>
              <div class="grid items-start gap-3" :style="gridStyle">
                <BookmarkCard
                  v-for="item in homepageRecentBookmarks"
                  :key="`recent-${item.id}`"
                  :item="item"
                  :target="openTarget"
                  @edit="handleStartEditBookmark"
                  :is-pinned="bookmarksStore.isBookmarkPinned(item.id)"
                  :open-count="getBookmarkOpenCount(item.id)"
                  :show-open-count="settingsStore.settings.showOpenCount"
                  @toggle-pin="handleToggleBookmarkPin"
                  @open="handleBookmarkOpen"
                />
              </div>
            </section>

            <section v-if="bookmarksStore.currentFolders.length > 0" class="space-y-2">
              <div
                v-if="bookmarksStore.currentBookmarks.length > 0"
                class="editorial-section-title px-1 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400"
              >
                目录
              </div>
              <div class="grid items-start gap-3" :style="gridStyle">
                <FolderCard
                  v-for="folder in bookmarksStore.currentFolders"
                  :key="folder.id"
                  :folder="folder"
                  @open="bookmarksStore.goToFolder"
                  @edit="handleStartEditFolder"
                />
              </div>
            </section>

            <section v-if="bookmarksStore.currentBookmarks.length > 0" class="space-y-2">
              <div
                v-if="bookmarksStore.currentFolders.length > 0"
                class="editorial-section-title px-1 text-xs font-medium tracking-wide text-slate-500 dark:text-slate-400"
              >
                书签
              </div>
              <div class="grid items-start gap-3" :style="gridStyle">
                <BookmarkCard
                  v-for="item in bookmarksStore.currentBookmarks"
                  :key="item.id"
                  :item="item"
                  :target="openTarget"
                  @edit="handleStartEditBookmark"
                  :is-pinned="bookmarksStore.isBookmarkPinned(item.id)"
                  :open-count="getBookmarkOpenCount(item.id)"
                  :show-open-count="settingsStore.settings.showOpenCount"
                  @toggle-pin="handleToggleBookmarkPin"
                  @open="handleBookmarkOpen"
                />
              </div>
            </section>
          </div>
        </div>
      </a-spin>
    </div>

    <a-modal
      :open="isEditModalOpen"
      title="编辑书签"
      wrap-class-name="editorial-modal-wrap"
      :mask-closable="!isEditSaving"
      @cancel="handleCancelEditBookmark"
    >
      <a-form layout="vertical">
        <a-form-item label="当前路径">
          <button
            type="button"
            :disabled="isEditSaving"
            class="w-full cursor-pointer rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600 transition hover:border-[#b59b7a] hover:bg-[#f6efe6] disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-[#7f6c58] dark:hover:bg-[#332a21]"
            @click="handleJumpToEditBookmarkFolder"
          >
            {{ editBookmarkPath }}
          </button>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            点击可跳转到该目录
          </div>
        </a-form-item>

        <a-form-item label="目录位置" required>
          <div class="flex items-start gap-2">
            <a-tree-select
              v-model:value="editForm.parentId"
              class="flex-1"
              :tree-data="bookmarksStore.folderTreeOptions"
              :disabled="isEditSaving || bookmarksStore.folderTreeOptions.length === 0"
              placeholder="请选择目标目录"
              show-search
              tree-default-expand-all
            />
            <a-button
              :disabled="isEditSaving || bookmarksStore.folderTreeOptions.length === 0"
              @click="handleOpenCreateFolderModal"
            >
              新增目录
            </a-button>
          </div>
          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
            保存后将移动到：{{ selectedEditFolderPath }}
          </div>
        </a-form-item>

        <a-form-item label="标题" required>
          <a-input
            v-model:value="editForm.title"
            :maxlength="200"
            :disabled="isEditSaving"
            placeholder="请输入书签标题"
          />
        </a-form-item>

        <a-form-item label="地址" required>
          <a-input
            v-model:value="editForm.url"
            :disabled="isEditSaving"
            placeholder="请输入书签地址"
          />
        </a-form-item>

        <div v-if="editFormError" class="text-xs text-red-600 dark:text-red-400">
          {{ editFormError }}
        </div>
      </a-form>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <a-popconfirm
            title="确认删除这个书签吗？"
            description="删除后无法恢复。"
            ok-text="确认删除"
            cancel-text="取消"
            :disabled="isEditSaving"
            @confirm="handleConfirmDeleteBookmark"
          >
            <a-button danger :disabled="isEditSaving">删除书签</a-button>
          </a-popconfirm>

          <div class="flex items-center gap-2">
            <a-button :disabled="isEditSaving" @click="handleCancelEditBookmark">取消</a-button>
            <a-button type="primary" :loading="isEditSaving" @click="handleConfirmEditBookmark">保存</a-button>
          </div>
        </div>
      </template>
    </a-modal>

    <a-modal
      :open="isEditFolderModalOpen"
      title="编辑目录"
      wrap-class-name="editorial-modal-wrap"
      :mask-closable="!isEditFolderSaving"
      @cancel="handleCancelEditFolder"
    >
      <a-form layout="vertical">
        <a-form-item label="当前路径">
          <div
            class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {{ editFolderPath }}
          </div>
        </a-form-item>

        <a-form-item label="目录名称" required>
          <a-input
            v-model:value="editFolderForm.title"
            :maxlength="100"
            :disabled="isEditFolderSaving"
            placeholder="请输入目录名称"
          />
        </a-form-item>

        <a-form-item label="目录位置" required>
          <a-tree-select
            v-model:value="editFolderForm.parentId"
            :tree-data="folderMoveTreeOptions"
            :disabled="isEditFolderSaving || folderMoveTreeOptions.length === 0"
            placeholder="请选择目标目录"
            show-search
            tree-default-expand-all
          />
        </a-form-item>

        <a-form-item label="插入位置（选填）">
          <a-input
            v-model:value="editFolderForm.positionInput"
            :disabled="isEditFolderSaving"
            placeholder="留空默认移动到末尾"
          />
        </a-form-item>

        <div class="text-xs text-slate-500 dark:text-slate-400">
          保存后将移动到：{{ selectedEditFolderParentPath }}；可填范围 1 ~ {{ editFolderPositionMax }}。
        </div>
        <div v-if="editFolderFormError" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ editFolderFormError }}
        </div>
      </a-form>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <a-popconfirm
            title="确认删除这个目录吗？"
            description="仅支持删除空目录，删除后无法恢复。"
            ok-text="确认删除"
            cancel-text="取消"
            :disabled="isEditFolderSaving || !canDeleteCurrentFolder"
            @confirm="handleConfirmDeleteFolder"
          >
            <a-button danger :disabled="isEditFolderSaving" @click="handleDeleteFolderButtonClick">
              删除目录
            </a-button>
          </a-popconfirm>

          <div class="flex items-center gap-2">
            <a-button :disabled="isEditFolderSaving" @click="handleCancelEditFolder">取消</a-button>
            <a-button type="primary" :loading="isEditFolderSaving" @click="handleConfirmEditFolder">
              保存
            </a-button>
          </div>
        </div>
      </template>
    </a-modal>

    <a-modal
      :open="isCreateFolderModalOpen"
      title="新增目录"
      wrap-class-name="editorial-modal-wrap"
      ok-text="创建"
      cancel-text="取消"
      :confirm-loading="isCreateFolderSaving"
      :ok-button-props="{ disabled: bookmarksStore.folderTreeOptions.length === 0 }"
      :mask-closable="!isCreateFolderSaving"
      @cancel="handleCancelCreateFolderModal"
      @ok="handleConfirmCreateFolder"
    >
      <a-form layout="vertical">
        <a-form-item label="目录名称" required>
          <a-input
            v-model:value="createFolderForm.title"
            :maxlength="100"
            :disabled="isCreateFolderSaving"
            placeholder="请输入目录名称"
          />
        </a-form-item>

        <a-form-item label="父目录" required>
          <a-tree-select
            v-model:value="createFolderForm.parentId"
            :tree-data="bookmarksStore.folderTreeOptions"
            :disabled="isCreateFolderSaving || bookmarksStore.folderTreeOptions.length === 0"
            placeholder="请选择父目录"
            show-search
            tree-default-expand-all
          />
        </a-form-item>

        <a-form-item label="插入位置（选填）">
          <a-input
            v-model:value="createFolderForm.positionInput"
            :disabled="isCreateFolderSaving"
            placeholder="留空默认插入到末尾"
          />
        </a-form-item>

        <div class="text-xs text-slate-500 dark:text-slate-400">
          目标目录：{{ createFolderParentPath }}；可填范围 1 ~ {{ createFolderPositionMax }}。
        </div>
        <div v-if="createFolderFormError" class="mt-1 text-xs text-red-600 dark:text-red-400">
          {{ createFolderFormError }}
        </div>
      </a-form>
    </a-modal>

    <SettingsDrawer v-model:open="isSettingsOpen" />
  </div>
</template>

<script setup lang="ts">
import { BookOutlined, EditOutlined, PushpinFilled, PushpinOutlined, SettingOutlined } from '@ant-design/icons-vue';
import { message } from 'ant-design-vue';
import { useDebounce, useEventListener } from '@vueuse/core';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';

import BookmarkAvatar from '@/components/bookmarks/bookmark-avatar.vue';
import BookmarkCard from '@/components/bookmarks/bookmark-card.vue';
import FolderCard from '@/components/bookmarks/folder-card.vue';
import BreadcrumbNav from '@/components/navigation/breadcrumb-nav.vue';
import SettingsDrawer from '@/components/settings/settings-drawer.vue';
import { searchBookmarkItems } from '@/services/bookmarks-search';
import { useBookmarksStore } from '@/stores/bookmarks-store';
import { useSettingsStore } from '@/stores/settings-store';
import type { BookmarkFolderNode, BookmarkIndexItem } from '@/types/bookmarks';
import { logError } from '@/utils/logger';

interface FocusableInput {
  focus: () => void;
}

interface FolderTreeOption {
  value: string;
  title: string;
  children?: FolderTreeOption[];
}

const settingsStore = useSettingsStore();
const bookmarksStore = useBookmarksStore();
const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform || '');
const SEARCH_FOCUS_SHORTCUT_LABEL = isMacPlatform ? 'Cmd + K' : 'Ctrl + K';
const SEARCH_OPEN_IN_NEW_TAB_SHORTCUT_LABEL = isMacPlatform ? 'Cmd + Enter' : 'Ctrl + Enter';
const SEARCH_INITIAL_RENDER_LIMIT = 80;
const SEARCH_EXPANDED_RENDER_LIMIT = 200;

const isSettingsOpen = ref(false);
const searchInputRef = ref<FocusableInput | null>(null);
const isEditModalOpen = ref(false);
const isEditSaving = ref(false);
const isEditFolderModalOpen = ref(false);
const isEditFolderSaving = ref(false);
const isCreateFolderModalOpen = ref(false);
const isCreateFolderSaving = ref(false);
const editFormError = ref('');
const editFolderFormError = ref('');
const createFolderFormError = ref('');
const editForm = ref({
  bookmarkId: '',
  folderPath: '',
  originalParentId: '',
  parentId: '',
  title: '',
  url: '',
});
const createFolderForm = ref({
  title: '',
  parentId: '',
  positionInput: '',
});
const editFolderForm = ref({
  folderId: '',
  folderPath: '',
  title: '',
  originalParentId: '',
  parentId: '',
  positionInput: '',
});

const searchQuery = ref('');
const searchPlaceholder = `搜索书签（标题 / 域名 / URL / 拼音，${SEARCH_FOCUS_SHORTCUT_LABEL} 聚焦）`;
const debouncedSearchQuery = useDebounce(searchQuery, 120);
const trimmedSearchQuery = computed(() => searchQuery.value.trim());
const debouncedTrimmedSearchQuery = computed(() => debouncedSearchQuery.value.trim());

const openTarget = computed(() => (settingsStore.settings.openBehavior === 'newTab' ? '_blank' : '_self'));

const isSearchMode = computed(() => trimmedSearchQuery.value.length > 0);
const isSearchListView = computed(() => settingsStore.settings.searchResultView === 'list');

const searchResults = computed(() =>
  searchBookmarkItems(bookmarksStore.bookmarkItems, debouncedSearchQuery.value, {
    limit: 260,
    pinnedAtMap: bookmarksStore.pinnedBookmarkMap,
    recentOpenMap: bookmarksStore.recentOpenedBookmarkMap,
  })
);
const visibleSearchResultLimit = ref(SEARCH_INITIAL_RENDER_LIMIT);
const visibleSearchResults = computed(() => searchResults.value.slice(0, visibleSearchResultLimit.value));

const selectedIndex = ref(-1);

const canGoBack = computed(() => bookmarksStore.breadcrumbFolders.length > 1);
const isHomeFolder = computed(() => bookmarksStore.currentFolderId === settingsStore.settings.entryFolderId);

const homepageRecentBookmarks = computed(() => {
  if (!settingsStore.settings.showRecentOpened) return [];

  const rawRows = Number(settingsStore.settings.recentOpenedRows ?? 3);
  const rows = Number.isFinite(rawRows) ? Math.max(1, Math.min(6, Math.round(rawRows))) : 3;
  const rawCols = Number(settingsStore.settings.cardsPerRow ?? 5);
  const cols = Number.isFinite(rawCols) ? Math.max(2, Math.min(9, Math.round(rawCols))) : 5;
  const limit = rows * cols;
  return bookmarksStore.recentOpenedBookmarks.slice(0, limit);
});

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

const editBookmarkPath = computed(() => {
  const path = editForm.value.folderPath.trim();
  return path || '根目录';
});

const selectedEditFolderPath = computed(() => {
  const parentId = editForm.value.parentId.trim();
  if (!parentId) return '未选择目录';

  const folder = bookmarksStore.folderNodes.find((node) => node.id === parentId);
  if (!folder) return '未知目录';

  return folder.folderPath || folder.title || '根目录';
});

const editFolderPath = computed(() => {
  const path = editFolderForm.value.folderPath.trim();
  return path || '根目录';
});

const selectedEditFolderParentPath = computed(() => {
  const parentId = editFolderForm.value.parentId.trim();
  if (!parentId) return '未选择目录';

  const folder = bookmarksStore.folderNodes.find((node) => node.id === parentId);
  if (!folder) return '未知目录';

  return folder.folderPath || folder.title || '根目录';
});

const editFolderParent = computed(() =>
  bookmarksStore.folderNodes.find((node) => node.id === editFolderForm.value.parentId.trim())
);

const currentEditingFolder = computed(() =>
  bookmarksStore.folderNodes.find((node) => node.id === editFolderForm.value.folderId.trim())
);

const canDeleteCurrentFolder = computed(() => {
  const folder = currentEditingFolder.value;
  if (!folder) return false;
  return folder.childFolderIds.length === 0 && folder.childBookmarkIds.length === 0;
});

const editFolderPositionMax = computed(() => {
  const parent = editFolderParent.value;
  if (!parent) return 1;
  return Math.max(1, parent.childFolderIds.length + parent.childBookmarkIds.length + 1);
});

const folderMoveTreeOptions = computed<FolderTreeOption[]>(() => {
  const nodes = bookmarksStore.folderNodes;
  if (nodes.length === 0) return [];

  const folderById = new Map(nodes.map((node) => [node.id, node]));
  const root = nodes.find((node) => !node.parentId);
  if (!root) return [];

  function buildOption(folderId: string): FolderTreeOption | null {
    const folder = folderById.get(folderId);
    if (!folder) return null;

    const children: FolderTreeOption[] = [];
    for (const childId of folder.childFolderIds) {
      const childOption = buildOption(childId);
      if (childOption) children.push(childOption);
    }

    const option: FolderTreeOption = {
      value: folder.id,
      title: folder.title || '未命名文件夹',
    };
    if (children.length > 0) option.children = children;
    return option;
  }

  const rootOption = buildOption(root.id);
  return rootOption ? [rootOption] : [];
});

const createFolderParent = computed(() =>
  bookmarksStore.folderNodes.find((node) => node.id === createFolderForm.value.parentId.trim())
);

const createFolderParentPath = computed(() => {
  const parent = createFolderParent.value;
  if (!parent) return '未选择目录';
  return parent.folderPath || parent.title || '根目录';
});

const createFolderPositionMax = computed(() => {
  const parent = createFolderParent.value;
  if (!parent) return 1;
  return Math.max(1, parent.childFolderIds.length + parent.childBookmarkIds.length + 1);
});

let searchRenderTimer: ReturnType<typeof setTimeout> | null = null;

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
  selectedIndex.value = -1;
  isSettingsOpen.value = false;
  bookmarksStore.setCurrentFolder(settingsStore.settings.entryFolderId);
  focusSearchInput();
}

function resetEditForm() {
  editFormError.value = '';
  createFolderFormError.value = '';
  isCreateFolderModalOpen.value = false;
  isCreateFolderSaving.value = false;
  editForm.value = {
    bookmarkId: '',
    folderPath: '',
    originalParentId: '',
    parentId: '',
    title: '',
    url: '',
  };
  createFolderForm.value = {
    title: '',
    parentId: '',
    positionInput: '',
  };
}

function resetEditFolderForm() {
  editFolderFormError.value = '';
  editFolderForm.value = {
    folderId: '',
    folderPath: '',
    title: '',
    originalParentId: '',
    parentId: '',
    positionInput: '',
  };
}

function handleStartEditBookmark(item: BookmarkIndexItem) {
  isEditSaving.value = false;
  isCreateFolderSaving.value = false;
  isEditFolderModalOpen.value = false;
  resetEditFolderForm();
  editFormError.value = '';
  createFolderFormError.value = '';
  isCreateFolderModalOpen.value = false;
  editForm.value = {
    bookmarkId: item.id,
    folderPath: item.folderPath,
    originalParentId: item.parentId ?? '',
    parentId: item.parentId ?? '',
    title: item.title,
    url: item.url,
  };
  createFolderForm.value = {
    title: '',
    parentId: item.parentId ?? '',
    positionInput: '',
  };
  isEditModalOpen.value = true;
}

function handleJumpToEditBookmarkFolder() {
  if (isEditSaving.value) return;

  const folderId = editForm.value.originalParentId.trim() || editForm.value.parentId.trim();
  if (!folderId) {
    message.warning('当前书签未关联目录');
    return;
  }

  const ok = bookmarksStore.setCurrentFolder(folderId);
  if (!ok) {
    message.warning('目标目录不存在，可能已被删除');
    return;
  }

  searchQuery.value = '';
  selectedIndex.value = -1;
  isEditModalOpen.value = false;
  resetEditForm();
}

async function handleToggleBookmarkPin(item: BookmarkIndexItem) {
  const wasPinned = bookmarksStore.isBookmarkPinned(item.id);
  const ok = await bookmarksStore.toggleBookmarkPin(item.id);
  if (!ok) {
    message.error('置顶状态更新失败');
    return;
  }

  message.success(wasPinned ? '已取消置顶' : '已置顶');
}

function handleStartEditFolder(folder: BookmarkFolderNode) {
  isEditFolderSaving.value = false;
  editFolderFormError.value = '';
  editFolderForm.value = {
    folderId: folder.id,
    folderPath: folder.folderPath,
    title: folder.title,
    originalParentId: folder.parentId ?? '',
    parentId: folder.parentId ?? '',
    positionInput: '',
  };
  isEditFolderModalOpen.value = true;
}

function handleCancelEditBookmark() {
  if (isEditSaving.value) return;
  isEditModalOpen.value = false;
  resetEditForm();
}

async function handleConfirmEditBookmark() {
  const bookmarkId = editForm.value.bookmarkId;
  const title = editForm.value.title.trim();
  const url = editForm.value.url.trim();
  const parentId = editForm.value.parentId.trim();

  if (!bookmarkId) {
    editFormError.value = '未选择可编辑的书签';
    return;
  }
  if (!title) {
    editFormError.value = '书签标题不能为空';
    return;
  }
  if (!url) {
    editFormError.value = '书签地址不能为空';
    return;
  }
  if (!parentId) {
    editFormError.value = '请选择书签目录';
    return;
  }

  editFormError.value = '';
  isEditSaving.value = true;
  try {
    const ok = await bookmarksStore.updateBookmark(
      bookmarkId,
      {
        title,
        url,
        parentId,
      },
      bookmarksStore.currentFolderId
    );
    if (!ok) {
      editFormError.value = bookmarksStore.errorMessage || '书签更新失败';
      return;
    }

    isEditModalOpen.value = false;
    resetEditForm();
  } finally {
    isEditSaving.value = false;
  }
}

function isFolderMoveTargetInvalid(folderId: string, targetParentId: string): boolean {
  if (!folderId || !targetParentId) return false;
  if (folderId === targetParentId) return true;

  const folderById = new Map(bookmarksStore.folderNodes.map((node) => [node.id, node]));
  let currentId: string | undefined = targetParentId;

  while (currentId) {
    if (currentId === folderId) return true;
    const node = folderById.get(currentId);
    if (!node?.parentId) break;
    currentId = node.parentId;
  }

  return false;
}

function handleCancelEditFolder() {
  if (isEditFolderSaving.value) return;
  isEditFolderModalOpen.value = false;
  resetEditFolderForm();
}

function handleDeleteFolderButtonClick() {
  if (isEditFolderSaving.value) return;
  if (canDeleteCurrentFolder.value) return;
  message.warning('目录非空，不能删除');
}

async function handleConfirmEditFolder() {
  const folderId = editFolderForm.value.folderId;
  const title = editFolderForm.value.title.trim();
  const originalParentId = editFolderForm.value.originalParentId.trim();
  const parentId = editFolderForm.value.parentId.trim();
  const positionInput = editFolderForm.value.positionInput.trim();
  const positionMax = editFolderPositionMax.value;

  if (!folderId) {
    editFolderFormError.value = '未选择可编辑的目录';
    return;
  }
  if (!title) {
    editFolderFormError.value = '目录名称不能为空';
    return;
  }
  if (!parentId) {
    editFolderFormError.value = '请选择目录位置';
    return;
  }
  if (isFolderMoveTargetInvalid(folderId, parentId)) {
    editFolderFormError.value = '目录位置不能是当前目录或其子目录';
    return;
  }

  let index: number | undefined;
  if (positionInput) {
    const parsed = Number(positionInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > positionMax) {
      editFolderFormError.value = `插入位置必须是 1 ~ ${positionMax} 的整数`;
      return;
    }
    index = parsed - 1;
  }

  editFolderFormError.value = '';
  isEditFolderSaving.value = true;
  try {
    const hasParentChanged = originalParentId !== parentId;
    const payload: {
      title: string;
      parentId?: string;
      index?: number;
    } = {
      title,
    };
    if (hasParentChanged || index != null) {
      payload.parentId = parentId;
    }
    if (index != null) {
      payload.index = index;
    }

    const ok = await bookmarksStore.updateFolder(
      folderId,
      payload,
      bookmarksStore.currentFolderId || settingsStore.settings.entryFolderId
    );
    if (!ok) {
      editFolderFormError.value = bookmarksStore.errorMessage || '目录更新失败';
      return;
    }

    message.success('目录更新成功');
    isEditFolderModalOpen.value = false;
    resetEditFolderForm();
  } finally {
    isEditFolderSaving.value = false;
  }
}

async function handleConfirmDeleteFolder() {
  const folderId = editFolderForm.value.folderId.trim();
  if (!folderId) {
    editFolderFormError.value = '未选择可删除的目录';
    return;
  }
  if (!canDeleteCurrentFolder.value) {
    message.warning('目录非空，不能删除');
    return;
  }

  editFolderFormError.value = '';
  isEditFolderSaving.value = true;
  try {
    const ok = await bookmarksStore.deleteFolder(
      folderId,
      bookmarksStore.currentFolderId || settingsStore.settings.entryFolderId
    );
    if (!ok) {
      editFolderFormError.value = bookmarksStore.errorMessage || '目录删除失败';
      return;
    }

    message.success('目录删除成功');
    isEditFolderModalOpen.value = false;
    resetEditFolderForm();
  } finally {
    isEditFolderSaving.value = false;
  }
}

function getFirstFolderOptionValue(options: readonly FolderTreeOption[]): string {
  if (options.length === 0) return '';
  return String(options[0]?.value || '');
}

function handleOpenCreateFolderModal() {
  if (isEditSaving.value) return;

  createFolderFormError.value = '';
  createFolderForm.value.title = '';
  createFolderForm.value.positionInput = '';

  const preferredParentId = editForm.value.parentId.trim();
  if (preferredParentId) {
    createFolderForm.value.parentId = preferredParentId;
  } else if (!createFolderForm.value.parentId.trim()) {
    createFolderForm.value.parentId = getFirstFolderOptionValue(
      bookmarksStore.folderTreeOptions as FolderTreeOption[]
    );
  }

  isCreateFolderModalOpen.value = true;
}

function handleCancelCreateFolderModal() {
  if (isCreateFolderSaving.value) return;

  isCreateFolderModalOpen.value = false;
  createFolderFormError.value = '';
  createFolderForm.value.title = '';
  createFolderForm.value.positionInput = '';
}

async function handleConfirmCreateFolder() {
  const title = createFolderForm.value.title.trim();
  const parentId = createFolderForm.value.parentId.trim();
  const positionInput = createFolderForm.value.positionInput.trim();
  const positionMax = createFolderPositionMax.value;

  if (!title) {
    createFolderFormError.value = '目录名称不能为空';
    return;
  }
  if (!parentId) {
    createFolderFormError.value = '请选择父目录';
    return;
  }

  let index: number | undefined;
  if (positionInput) {
    const parsed = Number(positionInput);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > positionMax) {
      createFolderFormError.value = `插入位置必须是 1 ~ ${positionMax} 的整数`;
      return;
    }
    index = parsed - 1;
  }

  const previousFolderIds = new Set(bookmarksStore.folderNodes.map((folder) => folder.id));

  createFolderFormError.value = '';
  isCreateFolderSaving.value = true;
  try {
    const ok = await bookmarksStore.createFolder(
      {
        title,
        parentId,
        index,
      },
      bookmarksStore.currentFolderId || settingsStore.settings.entryFolderId
    );
    if (!ok) {
      createFolderFormError.value = bookmarksStore.errorMessage || '创建目录失败';
      return;
    }

    const createdFolder = bookmarksStore.folderNodes.find((folder) => {
      return !previousFolderIds.has(folder.id) && folder.parentId === parentId && folder.title.trim() === title;
    });

    editForm.value.parentId = createdFolder?.id || parentId;
    message.success('目录创建成功');
    isCreateFolderModalOpen.value = false;
    createFolderForm.value.title = '';
    createFolderForm.value.positionInput = '';
  } finally {
    isCreateFolderSaving.value = false;
  }
}

async function handleConfirmDeleteBookmark() {
  const bookmarkId = editForm.value.bookmarkId;
  if (!bookmarkId) {
    editFormError.value = '未选择可删除的书签';
    return;
  }

  editFormError.value = '';
  isEditSaving.value = true;
  try {
    const ok = await bookmarksStore.deleteBookmark(bookmarkId, bookmarksStore.currentFolderId);
    if (!ok) {
      editFormError.value = bookmarksStore.errorMessage || '书签删除失败';
      return;
    }

    isEditModalOpen.value = false;
    resetEditForm();
  } finally {
    isEditSaving.value = false;
  }
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

function openBookmarkInNewTabOnly(item: BookmarkIndexItem) {
  void bookmarksStore.recordBookmarkOpened(item.id);
  window.open(item.url, '_blank', 'noopener');
}

function getActiveSearchItem(): BookmarkIndexItem | null {
  const items = visibleSearchResults.value;
  if (items.length === 0) return null;

  if (selectedIndex.value >= 0 && selectedIndex.value < items.length) {
    return items[selectedIndex.value];
  }

  return items[0] ?? null;
}

function getBookmarkOpenCount(bookmarkId: string): number {
  const record = bookmarksStore.getBookmarkRecentOpenRecord(bookmarkId);
  const count = Number(record?.openCount ?? 0);
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.floor(count);
}

function handleBookmarkOpen(item: BookmarkIndexItem) {
  void bookmarksStore.recordBookmarkOpened(item.id);
}

function handleSearchListTogglePin(item: BookmarkIndexItem, event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  void handleToggleBookmarkPin(item);
}

function handleSearchListEdit(item: BookmarkIndexItem, event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  handleStartEditBookmark(item);
}

function handleSearchKeydown(event: KeyboardEvent) {
  if (!isSearchMode.value) return;

  if (event.key === 'ArrowDown') {
    if (visibleSearchResults.value.length === 0) return;
    event.preventDefault();
    selectedIndex.value = Math.min(selectedIndex.value + 1, visibleSearchResults.value.length - 1);
    return;
  }

  if (event.key === 'ArrowUp') {
    if (visibleSearchResults.value.length === 0) return;
    event.preventDefault();
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    searchQuery.value = '';
    selectedIndex.value = -1;
    return;
  }

  if (event.key === 'Enter') {
    // 阻止输入框默认提交/冒泡行为，避免当前页被覆盖跳转。
    event.preventDefault();
    event.stopPropagation();

    const forceNewTab = event.metaKey || event.ctrlKey;
    if (!forceNewTab) return;

    const selected = getActiveSearchItem();
    if (!selected) return;
    openBookmarkInNewTabOnly(selected);
  }
}

async function handleRefresh() {
  await bookmarksStore.refreshFromChrome(settingsStore.settings.entryFolderId);
}

function clearSearchRenderTimer() {
  if (!searchRenderTimer) return;
  clearTimeout(searchRenderTimer);
  searchRenderTimer = null;
}

function syncAutoRefreshSubscription() {
  bookmarksStore.stopAutoRefresh();

  if (!settingsStore.settings.autoRefreshBookmarks) return;
  if (!bookmarksStore.isReady) return;

  bookmarksStore.startAutoRefresh(() => settingsStore.settings.entryFolderId);
}

watch(searchResults, (results) => {
  selectedIndex.value = -1;
  clearSearchRenderTimer();

  if (results.length <= SEARCH_INITIAL_RENDER_LIMIT) {
    visibleSearchResultLimit.value = results.length;
    return;
  }

  visibleSearchResultLimit.value = SEARCH_INITIAL_RENDER_LIMIT;
  searchRenderTimer = setTimeout(() => {
    visibleSearchResultLimit.value = Math.min(results.length, SEARCH_EXPANDED_RENDER_LIMIT);
    searchRenderTimer = null;
  }, 120);
});

watch(
  () => settingsStore.settings.entryFolderId,
  (folderId) => {
    if (!bookmarksStore.isReady) return;
    bookmarksStore.setCurrentFolder(folderId);
    syncAutoRefreshSubscription();
  }
);

watch(
  () => settingsStore.settings.autoRefreshBookmarks,
  () => {
    syncAutoRefreshSubscription();
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

onUnmounted(() => {
  clearSearchRenderTimer();
  bookmarksStore.stopAutoRefresh();
});

async function initPage() {
  try {
    if (!settingsStore.isReady) await settingsStore.initSettings();
    await bookmarksStore.bootstrap(settingsStore.settings.entryFolderId);
    syncAutoRefreshSubscription();
    await nextTick();
    focusSearchInput();
  } catch (error) {
    logError('页面初始化失败', error);
  }
}
</script>
