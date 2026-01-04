import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import { buildBookmarkIndex, fetchBookmarksTree } from '@/services/bookmarks-service';
import { getFromStorage, removeFromStorage, setToStorage } from '@/services/storage-service';
import type { BookmarkCachePayload, BookmarkFolderNode, BookmarkIndexItem } from '@/types/bookmarks';
import { logError, logInfo } from '@/utils/logger';

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

export const useBookmarksStore = defineStore('bookmarks', () => {
  const isReady = ref(false);
  const isLoading = ref(false);
  const hasError = ref(false);
  const errorMessage = ref<string | null>(null);

  const folderNodes = ref<BookmarkFolderNode[]>([]);
  const bookmarkItems = ref<BookmarkIndexItem[]>([]);

  const folderMap = ref<Record<string, BookmarkFolderNode>>({});
  const bookmarkMap = ref<Record<string, BookmarkIndexItem>>({});

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
    return folder.childBookmarkIds
      .map((id: string) => bookmarkMap.value[id])
      .filter((item): item is BookmarkIndexItem => Boolean(item));
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

  async function loadCache(entryFolderId: string): Promise<void> {
    try {
      const cached = await getFromStorage<BookmarkCachePayload>(STORAGE_KEYS.bookmarksCache);
      if (!cached || cached.schemaVersion !== 1) return;

      if (!Array.isArray(cached.folderNodes) || !Array.isArray(cached.bookmarkItems)) {
        logError('书签缓存格式异常，已忽略并清理', cached);
        await removeFromStorage(STORAGE_KEYS.bookmarksCache);
        return;
      }

      folderNodes.value = cached.folderNodes;
      bookmarkItems.value = cached.bookmarkItems;
      folderMap.value = buildFolderMap(folderNodes.value);
      bookmarkMap.value = buildBookmarkMap(bookmarkItems.value);
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

  async function bootstrap(entryFolderId: string): Promise<void> {
    try {
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

    // actions
    setCurrentFolder,
    goToFolder,
    goToParentFolder,
    bootstrap,
    refreshFromChrome,
    loadCache,
  };
});


