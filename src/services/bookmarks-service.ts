import type { BookmarkFolderNode, BookmarkIndexItem } from '@/types/bookmarks';
import { normalizeSearchText } from '@/utils/text';
import { getDomainFromUrl } from '@/utils/url';
import { logError, logInfo } from '@/utils/logger';

import {
  createMockFolder,
  getMockBookmarksTree,
  moveMockBookmark,
  moveMockFolder,
  removeMockBookmark,
  removeMockFolder,
  updateMockBookmark,
  updateMockFolder,
} from './mock-bookmarks';

function isChromeBookmarksAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.getTree;
}

function isChromeBookmarksUpdateAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.update;
}

function isChromeBookmarksRemoveAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.remove;
}

function isChromeBookmarksMoveAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.move;
}

function isChromeBookmarksCreateAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.create;
}

function isChromeBookmarksEventsAvailable(): boolean {
  return Boolean(
    globalThis.chrome?.bookmarks?.onCreated &&
      globalThis.chrome?.bookmarks?.onRemoved &&
      globalThis.chrome?.bookmarks?.onChanged &&
      globalThis.chrome?.bookmarks?.onMoved
  );
}

export interface CreateFolderPayload {
  title: string;
  parentId: string;
  index?: number;
}

export interface UpdateFolderPayload {
  title: string;
  parentId?: string;
  index?: number;
}

export type BookmarksEventsUnsubscribe = () => void;

function getFolderTitle(node: chrome.bookmarks.BookmarkTreeNode): string {
  const rawTitle = (node.title ?? '').trim();
  if (node.parentId == null) return '根目录';
  return rawTitle || '未命名文件夹';
}

function joinFolderPath(parentPath: string, title: string): string {
  if (!parentPath) return title;
  return `${parentPath}/${title}`;
}

export async function fetchBookmarksTree(): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  if (!isChromeBookmarksAvailable()) {
    logInfo('当前不是扩展环境，使用 mock 书签数据预览 UI');
    return getMockBookmarksTree();
  }

  return await new Promise<chrome.bookmarks.BookmarkTreeNode[]>((resolve, reject) => {
    try {
      chrome.bookmarks.getTree((nodes) => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve(nodes);
      });
    } catch (error) {
      reject(error);
    }
  });
}

export interface UpdateBookmarkPayload {
  title: string;
  url: string;
  parentId?: string;
}

export async function updateBookmark(
  bookmarkId: string,
  payload: UpdateBookmarkPayload
): Promise<void> {
  const nextTitle = payload.title.trim();
  const nextUrl = payload.url.trim();
  const nextParentId = payload.parentId?.trim();

  if (!bookmarkId) {
    throw new Error('缺少书签 ID，无法更新');
  }
  if (!nextTitle) {
    throw new Error('书签标题不能为空');
  }
  if (!nextUrl) {
    throw new Error('书签地址不能为空');
  }

  if (!isChromeBookmarksUpdateAvailable()) {
    const ok = updateMockBookmark(bookmarkId, {
      title: nextTitle,
      url: nextUrl,
    });
    if (!ok) {
      throw new Error('未找到可编辑的 mock 书签');
    }
    if (nextParentId) {
      const moved = moveMockBookmark(bookmarkId, nextParentId);
      if (!moved) {
        throw new Error('书签目录移动失败');
      }
    }
    logInfo('mock 书签更新完成', { bookmarkId });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.update(
        bookmarkId,
        {
          title: nextTitle,
          url: nextUrl,
        },
        (node) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!node) {
            reject(new Error('书签更新失败'));
            return;
          }
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });

  if (nextParentId) {
    if (!isChromeBookmarksMoveAvailable()) {
      throw new Error('当前环境不支持移动书签目录');
    }

    await new Promise<void>((resolve, reject) => {
      try {
        chrome.bookmarks.move(bookmarkId, { parentId: nextParentId }, (node) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!node) {
            reject(new Error('书签目录移动失败'));
            return;
          }
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  return;
}

export async function createFolder(payload: CreateFolderPayload): Promise<void> {
  const title = payload.title.trim();
  const parentId = payload.parentId.trim();
  const index = payload.index;
  const hasValidIndex = Number.isFinite(index);
  const safeIndex = hasValidIndex ? Math.max(0, Math.floor(index as number)) : undefined;

  if (!title) {
    throw new Error('目录名称不能为空');
  }
  if (!parentId) {
    throw new Error('缺少父目录，无法创建');
  }

  if (!isChromeBookmarksCreateAvailable()) {
    const ok = createMockFolder({
      title,
      parentId,
      index: safeIndex,
    });
    if (!ok) {
      throw new Error('mock 目录创建失败');
    }
    logInfo('mock 目录创建完成', { parentId, title });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.create(
        {
          title,
          parentId,
          index: safeIndex,
        },
        (node) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!node) {
            reject(new Error('目录创建失败'));
            return;
          }
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

export async function updateFolder(
  folderId: string,
  payload: UpdateFolderPayload
): Promise<void> {
  const nextTitle = payload.title.trim();
  const nextParentId = payload.parentId?.trim();
  const hasValidIndex = Number.isFinite(payload.index);
  const safeIndex = hasValidIndex ? Math.max(0, Math.floor(payload.index as number)) : undefined;

  if (!folderId) {
    throw new Error('缺少目录 ID，无法更新');
  }
  if (!nextTitle) {
    throw new Error('目录名称不能为空');
  }
  if (nextParentId && nextParentId === folderId) {
    throw new Error('目录位置不能是自身');
  }

  if (!isChromeBookmarksUpdateAvailable()) {
    const updated = updateMockFolder(folderId, {
      title: nextTitle,
    });
    if (!updated) {
      throw new Error('未找到可编辑的 mock 目录');
    }

    if (nextParentId) {
      const moved = moveMockFolder(folderId, nextParentId, safeIndex);
      if (!moved) {
        throw new Error('目录位置更新失败');
      }
    }

    logInfo('mock 目录更新完成', { folderId });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.update(
        folderId,
        {
          title: nextTitle,
        },
        (node) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!node) {
            reject(new Error('目录更新失败'));
            return;
          }
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });

  const shouldMove = Boolean(nextParentId) || safeIndex != null;
  if (!shouldMove) return;

  if (!isChromeBookmarksMoveAvailable()) {
    throw new Error('当前环境不支持移动目录');
  }

  await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.move(
        folderId,
        {
          parentId: nextParentId,
          index: safeIndex,
        },
        (node) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            reject(new Error(lastError.message));
            return;
          }
          if (!node) {
            reject(new Error('目录位置更新失败'));
            return;
          }
          resolve();
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

export async function deleteBookmark(bookmarkId: string): Promise<void> {
  if (!bookmarkId) {
    throw new Error('缺少书签 ID，无法删除');
  }

  if (!isChromeBookmarksRemoveAvailable()) {
    const ok = removeMockBookmark(bookmarkId);
    if (!ok) {
      throw new Error('未找到可删除的 mock 书签');
    }
    logInfo('mock 书签删除完成', { bookmarkId });
    return;
  }

  return await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.remove(bookmarkId, () => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function deleteBookmarks(bookmarkIds: string[]): Promise<void> {
  if (!Array.isArray(bookmarkIds) || bookmarkIds.length === 0) return;

  const uniqueIds = Array.from(new Set(bookmarkIds.map((id) => id.trim()).filter(Boolean)));
  for (const bookmarkId of uniqueIds) {
    await deleteBookmark(bookmarkId);
  }
}

export function subscribeBookmarksEvents(onAnyChange: () => void): BookmarksEventsUnsubscribe {
  if (!isChromeBookmarksEventsAvailable()) {
    return () => {};
  }

  const handleCreated = (_id: string, _node: chrome.bookmarks.BookmarkTreeNode) => {
    onAnyChange();
  };
  const handleRemoved = (_id: string, _removeInfo: chrome.bookmarks.BookmarkRemoveInfo) => {
    onAnyChange();
  };
  const handleChanged = (_id: string, _changeInfo: chrome.bookmarks.BookmarkChangeInfo) => {
    onAnyChange();
  };
  const handleMoved = (_id: string, _moveInfo: chrome.bookmarks.BookmarkMoveInfo) => {
    onAnyChange();
  };

  chrome.bookmarks.onCreated.addListener(handleCreated);
  chrome.bookmarks.onRemoved.addListener(handleRemoved);
  chrome.bookmarks.onChanged.addListener(handleChanged);
  chrome.bookmarks.onMoved.addListener(handleMoved);

  return () => {
    chrome.bookmarks.onCreated.removeListener(handleCreated);
    chrome.bookmarks.onRemoved.removeListener(handleRemoved);
    chrome.bookmarks.onChanged.removeListener(handleChanged);
    chrome.bookmarks.onMoved.removeListener(handleMoved);
  };
}

export async function deleteFolder(folderId: string): Promise<void> {
  if (!folderId) {
    throw new Error('缺少目录 ID，无法删除');
  }

  if (!isChromeBookmarksRemoveAvailable()) {
    const ok = removeMockFolder(folderId);
    if (!ok) {
      throw new Error('目录不存在或非空，无法删除');
    }
    logInfo('mock 目录删除完成', { folderId });
    return;
  }

  return await new Promise<void>((resolve, reject) => {
    try {
      chrome.bookmarks.remove(folderId, () => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export interface BuildBookmarkIndexResult {
  folderNodes: BookmarkFolderNode[];
  bookmarkItems: BookmarkIndexItem[];
}

export function buildBookmarkIndex(
  treeNodes: chrome.bookmarks.BookmarkTreeNode[]
): BuildBookmarkIndexResult {
  const folderMap = new Map<string, BookmarkFolderNode>();
  const bookmarkItems: BookmarkIndexItem[] = [];

  function ensureFolderNode(
    node: chrome.bookmarks.BookmarkTreeNode,
    parentFolderPath: string
  ): BookmarkFolderNode {
    const id = node.id;
    const existing = folderMap.get(id);
    if (existing) return existing;

    const title = getFolderTitle(node);
    const folderPath = node.parentId == null ? '' : joinFolderPath(parentFolderPath, title);

    const folderNode: BookmarkFolderNode = {
      id,
      parentId: node.parentId ?? undefined,
      title,
      folderPath,
      childFolderIds: [],
      childBookmarkIds: [],
    };

    folderMap.set(id, folderNode);
    return folderNode;
  }

  function walkFolder(
    node: chrome.bookmarks.BookmarkTreeNode,
    parentFolderPath: string
  ) {
    const currentFolder = ensureFolderNode(node, parentFolderPath);
    const nextFolderPath = currentFolder.folderPath;

    const children = node.children ?? [];
    for (const child of children) {
      if (child.url) {
        const url = child.url;
        const title = (child.title ?? '').trim() || url;
        const domain = getDomainFromUrl(url);
        const folderPath = nextFolderPath;
        const searchText = normalizeSearchText(`${title} ${domain} ${url} ${folderPath}`);

        const item: BookmarkIndexItem = {
          id: child.id,
          parentId: child.parentId ?? undefined,
          title,
          url,
          folderPath,
          domain,
          searchText,
        };

        bookmarkItems.push(item);
        currentFolder.childBookmarkIds.push(item.id);
        continue;
      }

      if (child.children) {
        currentFolder.childFolderIds.push(child.id);
        walkFolder(child, nextFolderPath);
      }
    }
  }

  for (const root of treeNodes) {
    // root.title 通常为空，这里统一创建“根目录”节点，folderPath 设为空，避免污染真实路径
    walkFolder(root, '');
  }

  const folderNodes = Array.from(folderMap.values());
  if (folderNodes.length === 0) {
    logError('书签树为空或解析失败');
  }

  return { folderNodes, bookmarkItems };
}
