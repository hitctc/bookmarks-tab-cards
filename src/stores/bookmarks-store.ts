import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import {
  buildBookmarkIndex,
  createFolder as createFolderInService,
  deleteBookmark as deleteBookmarkInService,
  fetchBookmarksTree,
  updateFolder as updateFolderInService,
  updateBookmark as updateBookmarkInService,
  type CreateFolderPayload,
  type UpdateFolderPayload,
  type UpdateBookmarkPayload,
} from '@/services/bookmarks-service';
import { getFromStorage, removeFromStorage, setToStorage } from '@/services/storage-service';
import type { BookmarkCachePayload, BookmarkFolderNode, BookmarkIndexItem } from '@/types/bookmarks';
import { logError, logInfo } from '@/utils/logger';

type BookmarkPinMap = Record<string, number>;

function buildFolderMap(folderNodes: BookmarkFolderNode[]): Record<string, BookmarkFolderNode> {
  const map: Record<string, BookmarkFolderNode> = {};
  for (const node of folderNodes) {
    map[node.id] = node;
  }
  return map;
}

function buildBookmarkMap(bookmarkItems: BookmarkIndexItem[]): Record<string, BookmarkIndexItem> {
  const map: Record<string, BookmarkIndexItem> = {};
  for (const item of bookmarkItems) {
    map[item.id] = item;
  }
  return map;
}

function getRootFolderId(folderMap: Record<string, BookmarkFolderNode>): string | null {
  for (const folderId of Object.keys(folderMap)) {
    const folder = folderMap[folderId];
    if (!folder.parentId) return folder.id;
  }
  return null;
}

function buildBreadcrumbIds(
  folderId: string,
  folderMap: Record<string, BookmarkFolderNode>
): string[] {
  const ids: string[] = [];
  let currentId: string | undefined = folderId;

  while (currentId) {
    const folder: BookmarkFolderNode | undefined = folderMap[currentId];
    if (!folder) break;
    ids.push(currentId);
    currentId = folder.parentId;
  }

  return ids.reverse();
}

function toCachePayload(
  folderNodes: BookmarkFolderNode[],
  bookmarkItems: BookmarkIndexItem[]
): BookmarkCachePayload {
  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    folderNodes,
    bookmarkItems,
  };
}

interface FolderTreeOption {
  value: string;
  title: string;
  children?: FolderTreeOption[];
}

function buildFolderTreeOptions(
  rootFolderId: string,
  folderMap: Record<string, BookmarkFolderNode>
): FolderTreeOption[] {
  const rootFolder = folderMap[rootFolderId];
  if (!rootFolder) return [];

  function buildOption(folderId: string): FolderTreeOption | null {
    const folder = folderMap[folderId];
    if (!folder) return null;

    const children: FolderTreeOption[] = [];
    for (const childId of folder.childFolderIds) {
      const childOption = buildOption(childId);
      if (childOption) children.push(childOption);
    }

    const option: FolderTreeOption = {
      value: folder.id,
      title: folder.title,
    };
    if (children.length > 0) option.children = children;
    return option;
  }

  const rootChildren: FolderTreeOption[] = [];
  for (const childId of rootFolder.childFolderIds) {
    const childOption = buildOption(childId);
    if (childOption) rootChildren.push(childOption);
  }

  return rootChildren;
}

function normalizeBookmarkPinMap(raw: unknown): BookmarkPinMap {
  if (!raw || typeof raw !== 'object') return {};

  const parsed = raw as Record<string, unknown>;
  const normalized: BookmarkPinMap = {};
  for (const [bookmarkId, pinnedAtValue] of Object.entries(parsed)) {
    const pinnedAt = Number(pinnedAtValue);
    if (!bookmarkId || !Number.isFinite(pinnedAt) || pinnedAt <= 0) continue;
    normalized[bookmarkId] = Math.floor(pinnedAt);
  }

  return normalized;
}

function cleanupBookmarkPinMap(pinMap: BookmarkPinMap, bookmarkItems: BookmarkIndexItem[]): BookmarkPinMap {
  if (Object.keys(pinMap).length === 0) return {};
  if (bookmarkItems.length === 0) return {};

  const validBookmarkIds = new Set(bookmarkItems.map((item) => item.id));
  const cleaned: BookmarkPinMap = {};
  for (const [bookmarkId, pinnedAt] of Object.entries(pinMap)) {
    if (!validBookmarkIds.has(bookmarkId)) continue;
    cleaned[bookmarkId] = pinnedAt;
  }
  return cleaned;
}

function isBookmarkPinMapEqual(a: BookmarkPinMap, b: BookmarkPinMap): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);
  if (aEntries.length !== bEntries.length) return false;

  for (const [bookmarkId, pinnedAt] of aEntries) {
    if (b[bookmarkId] !== pinnedAt) return false;
  }
  return true;
}

function sortBookmarksByPinTime(items: BookmarkIndexItem[], pinMap: BookmarkPinMap): BookmarkIndexItem[] {
  if (items.length <= 1) return items;

  return items
    .map((item, index) => ({
      item,
      index,
      pinnedAt: Number(pinMap[item.id] ?? 0),
    }))
    .sort((a, b) => {
      const aPinned = a.pinnedAt > 0;
      const bPinned = b.pinnedAt > 0;

      if (aPinned && bPinned) {
        if (a.pinnedAt !== b.pinnedAt) return a.pinnedAt - b.pinnedAt;
        return a.index - b.index;
      }

      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

export const useBookmarksStore = defineStore('bookmarks', () => {
  const isReady = ref(false);
  const isLoading = ref(false);
  const hasError = ref(false);
  const errorMessage = ref<string | null>(null);

  const folderNodes = ref<BookmarkFolderNode[]>([]);
  const bookmarkItems = ref<BookmarkIndexItem[]>([]);

  const folderMap = ref<Record<string, BookmarkFolderNode>>({});
  const bookmarkMap = ref<Record<string, BookmarkIndexItem>>({});
  const pinnedBookmarkMap = ref<BookmarkPinMap>({});

  const currentFolderId = ref<string>('1');
  const lastUpdatedAt = ref<number | null>(null);

  const rootFolderId = computed(() => getRootFolderId(folderMap.value));

  const breadcrumbFolderIds = computed(() =>
    buildBreadcrumbIds(currentFolderId.value, folderMap.value)
  );

  const breadcrumbFolders = computed(() =>
    breadcrumbFolderIds.value
      .map((id: string) => folderMap.value[id])
      .filter((folder): folder is BookmarkFolderNode => Boolean(folder))
  );

  const currentFolder = computed(() => folderMap.value[currentFolderId.value]);

  const currentFolders = computed(() => {
    const folder = currentFolder.value;
    if (!folder) return [];
    return folder.childFolderIds
      .map((id: string) => folderMap.value[id])
      .filter((child): child is BookmarkFolderNode => Boolean(child));
  });

  const currentBookmarks = computed(() => {
    const folder = currentFolder.value;
    if (!folder) return [];
    const items = folder.childBookmarkIds
      .map((id: string) => bookmarkMap.value[id])
      .filter((item): item is BookmarkIndexItem => Boolean(item));
    return sortBookmarksByPinTime(items, pinnedBookmarkMap.value);
  });

  const folderTreeOptions = computed(() => {
    const rootId = rootFolderId.value;
    if (!rootId) return [];
    return buildFolderTreeOptions(rootId, folderMap.value);
  });

  function setCurrentFolder(folderId: string): boolean {
    if (!folderMap.value[folderId]) return false;
    currentFolderId.value = folderId;
    return true;
  }

  function goToFolder(folderId: string): void {
    setCurrentFolder(folderId);
  }

  function goToParentFolder(): void {
    const folder = currentFolder.value;
    if (!folder?.parentId) return;
    setCurrentFolder(folder.parentId);
  }

  function isBookmarkPinned(bookmarkId: string): boolean {
    const safeId = bookmarkId.trim();
    if (!safeId) return false;
    return Number(pinnedBookmarkMap.value[safeId] ?? 0) > 0;
  }

  async function loadBookmarkPins(): Promise<void> {
    try {
      const stored = await getFromStorage<unknown>(STORAGE_KEYS.bookmarkPins);
      pinnedBookmarkMap.value = normalizeBookmarkPinMap(stored);
    } catch (error) {
      pinnedBookmarkMap.value = {};
      logError('读取书签置顶状态失败', error);
    }
  }

  async function syncBookmarkPinsWithItems(): Promise<void> {
    const cleaned = cleanupBookmarkPinMap(pinnedBookmarkMap.value, bookmarkItems.value);
    if (isBookmarkPinMapEqual(cleaned, pinnedBookmarkMap.value)) return;

    pinnedBookmarkMap.value = cleaned;
    const ok = await setToStorage(STORAGE_KEYS.bookmarkPins, cleaned);
    if (!ok) {
      logError('清理无效书签置顶状态失败');
    }
  }

  async function toggleBookmarkPin(bookmarkId: string): Promise<boolean> {
    const safeId = bookmarkId.trim();
    if (!safeId || !bookmarkMap.value[safeId]) return false;

    const previous = pinnedBookmarkMap.value;
    const next: BookmarkPinMap = { ...previous };
    if (next[safeId]) {
      delete next[safeId];
    } else {
      next[safeId] = Date.now();
    }

    pinnedBookmarkMap.value = next;
    const ok = await setToStorage(STORAGE_KEYS.bookmarkPins, next);
    if (ok) return true;

    pinnedBookmarkMap.value = previous;
    logError('保存书签置顶状态失败');
    return false;
  }

  async function loadCache(entryFolderId: string): Promise<void> {
    try {
      const cached = await getFromStorage<BookmarkCachePayload>(STORAGE_KEYS.bookmarksCache);
      if (!cached || cached.schemaVersion !== 1) return;

      if (!Array.isArray(cached.folderNodes) || !Array.isArray(cached.bookmarkItems)) {
        // 兼容旧缓存结构：自动清理后走后台刷新，不作为运行时错误上报
        logInfo('书签缓存格式不兼容，已自动清理', cached);
        await removeFromStorage(STORAGE_KEYS.bookmarksCache);
        return;
      }

      folderNodes.value = cached.folderNodes;
      bookmarkItems.value = cached.bookmarkItems;
      folderMap.value = buildFolderMap(folderNodes.value);
      bookmarkMap.value = buildBookmarkMap(bookmarkItems.value);
      await syncBookmarkPinsWithItems();
      lastUpdatedAt.value = cached.generatedAt ?? null;

      const ok = setCurrentFolder(entryFolderId);
      if (!ok) {
        const fallbackRoot = rootFolderId.value;
        if (fallbackRoot) setCurrentFolder(fallbackRoot);
      }

      logInfo('书签缓存加载完成', {
        folders: folderNodes.value.length,
        bookmarks: bookmarkItems.value.length,
      });
    } catch (error) {
      // 兜底：避免任何缓存异常导致白屏
      logError('书签缓存解析失败，已忽略并清理', error);
      await removeFromStorage(STORAGE_KEYS.bookmarksCache);
    }
  }

  async function refreshFromChrome(entryFolderId: string): Promise<void> {
    isLoading.value = true;
    try {
      hasError.value = false;
      errorMessage.value = null;

      const tree = await fetchBookmarksTree();
      const built = buildBookmarkIndex(tree);

      folderNodes.value = built.folderNodes;
      bookmarkItems.value = built.bookmarkItems;
      folderMap.value = buildFolderMap(folderNodes.value);
      bookmarkMap.value = buildBookmarkMap(bookmarkItems.value);
      await syncBookmarkPinsWithItems();

      const cachePayload = toCachePayload(folderNodes.value, bookmarkItems.value);
      await setToStorage(STORAGE_KEYS.bookmarksCache, cachePayload);
      lastUpdatedAt.value = cachePayload.generatedAt;

      const ok = setCurrentFolder(entryFolderId);
      if (!ok) {
        const fallbackRoot = rootFolderId.value;
        if (fallbackRoot) setCurrentFolder(fallbackRoot);
      }

      logInfo('书签刷新完成', {
        folders: folderNodes.value.length,
        bookmarks: bookmarkItems.value.length,
      });
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '书签读取失败';
      logError('书签读取失败', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function updateBookmark(
    bookmarkId: string,
    payload: UpdateBookmarkPayload,
    entryFolderId: string
  ): Promise<boolean> {
    try {
      hasError.value = false;
      errorMessage.value = null;
      await updateBookmarkInService(bookmarkId, payload);
      await refreshFromChrome(entryFolderId);
      if (hasError.value) return false;
      return true;
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '书签更新失败';
      logError('书签更新失败', error);
      return false;
    }
  }

  async function deleteBookmark(bookmarkId: string, entryFolderId: string): Promise<boolean> {
    try {
      hasError.value = false;
      errorMessage.value = null;
      await deleteBookmarkInService(bookmarkId);
      await refreshFromChrome(entryFolderId);
      if (hasError.value) return false;
      return true;
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '书签删除失败';
      logError('书签删除失败', error);
      return false;
    }
  }

  async function createFolder(payload: CreateFolderPayload, entryFolderId: string): Promise<boolean> {
    try {
      hasError.value = false;
      errorMessage.value = null;
      await createFolderInService(payload);
      await refreshFromChrome(entryFolderId);
      if (hasError.value) return false;
      return true;
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '创建目录失败';
      logError('创建目录失败', error);
      return false;
    }
  }

  async function updateFolder(
    folderId: string,
    payload: UpdateFolderPayload,
    entryFolderId: string
  ): Promise<boolean> {
    try {
      hasError.value = false;
      errorMessage.value = null;
      await updateFolderInService(folderId, payload);
      await refreshFromChrome(entryFolderId);
      if (hasError.value) return false;
      return true;
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '目录更新失败';
      logError('目录更新失败', error);
      return false;
    }
  }

  async function bootstrap(entryFolderId: string): Promise<void> {
    try {
      await loadBookmarkPins();
      await loadCache(entryFolderId);
    } catch (error) {
      // loadCache 内部已兜底，这里再保险一次，确保 initPage 不会因为缓存炸掉
      logError('书签初始化失败（缓存阶段）', error);
    } finally {
      isReady.value = true;
    }

    // 不阻塞首屏：后台刷新
    void refreshFromChrome(entryFolderId);
  }

  return {
    // state
    isReady,
    isLoading,
    hasError,
    errorMessage,
    folderNodes,
    bookmarkItems,
    currentFolderId,
    lastUpdatedAt,

    // computed
    breadcrumbFolders,
    currentFolder,
    currentFolders,
    currentBookmarks,
    folderTreeOptions,
    isBookmarkPinned,

    // actions
    setCurrentFolder,
    goToFolder,
    goToParentFolder,
    bootstrap,
    refreshFromChrome,
    updateBookmark,
    deleteBookmark,
    createFolder,
    updateFolder,
    loadCache,
    toggleBookmarkPin,
  };
});
