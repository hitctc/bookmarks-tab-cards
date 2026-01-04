import type { BookmarkFolderNode, BookmarkIndexItem } from '@/types/bookmarks';
import { normalizeSearchText } from '@/utils/text';
import { getDomainFromUrl } from '@/utils/url';
import { logError, logInfo } from '@/utils/logger';

import { getMockBookmarksTree } from './mock-bookmarks';

function isChromeBookmarksAvailable(): boolean {
  return !!globalThis.chrome?.bookmarks?.getTree;
}

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


