const initialMockBookmarksTree: chrome.bookmarks.BookmarkTreeNode[] = [
  {
    id: '0',
    title: '',
    children: [
      {
        id: '1',
        parentId: '0',
        title: '书签栏',
        children: [
          {
            id: '10',
            parentId: '1',
            title: 'Vue 文档',
            url: 'https://cn.vuejs.org/',
          },
          {
            id: '11',
            parentId: '1',
            title: 'Vite',
            url: 'https://vitejs.dev/',
          },
          {
            id: '12',
            parentId: '1',
            title: '工具箱',
            children: [
              {
                id: '120',
                parentId: '12',
                title: 'GitHub',
                url: 'https://github.com/',
              }
            ],
          },
        ],
      },
      {
        id: '2',
        parentId: '0',
        title: '其他书签',
        children: [
          {
            id: '20',
            parentId: '2',
            title: 'Chrome Extensions 文档',
            url: 'https://developer.chrome.com/docs/extensions/',
          }
        ],
      }
    ],
  },
];

let runtimeMockBookmarksTree: chrome.bookmarks.BookmarkTreeNode[] | null = null;

interface MockBookmarkUpdatePayload {
  title: string;
  url: string;
}

interface MockFolderUpdatePayload {
  title: string;
}

interface MockCreateFolderPayload {
  title: string;
  parentId: string;
  index?: number;
}

function cloneMockTree(
  tree: chrome.bookmarks.BookmarkTreeNode[]
): chrome.bookmarks.BookmarkTreeNode[] {
  return JSON.parse(JSON.stringify(tree)) as chrome.bookmarks.BookmarkTreeNode[];
}

function ensureRuntimeMockTree(): chrome.bookmarks.BookmarkTreeNode[] {
  if (!runtimeMockBookmarksTree) {
    runtimeMockBookmarksTree = cloneMockTree(initialMockBookmarksTree);
  }
  return runtimeMockBookmarksTree;
}

function findBookmarkNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  bookmarkId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  for (const node of nodes) {
    if (node.id === bookmarkId && node.url) {
      return node;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const found = findBookmarkNodeById(node.children, bookmarkId);
      if (found) return found;
    }
  }

  return null;
}

export function getMockBookmarksTree(): chrome.bookmarks.BookmarkTreeNode[] {
  return cloneMockTree(ensureRuntimeMockTree());
}

export function updateMockBookmark(
  bookmarkId: string,
  payload: MockBookmarkUpdatePayload
): boolean {
  if (!bookmarkId) return false;

  const runtimeTree = ensureRuntimeMockTree();
  const node = findBookmarkNodeById(runtimeTree, bookmarkId);
  if (!node) return false;

  node.title = payload.title;
  node.url = payload.url;
  return true;
}

export function updateMockFolder(folderId: string, payload: MockFolderUpdatePayload): boolean {
  if (!folderId) return false;

  const runtimeTree = ensureRuntimeMockTree();
  const node = findFolderNodeById(runtimeTree, folderId);
  if (!node) return false;
  if (node.parentId == null) return false;

  node.title = payload.title;
  return true;
}

function findFolderNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  for (const node of nodes) {
    if (node.id === folderId && Array.isArray(node.children)) {
      return node;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const found = findFolderNodeById(node.children, folderId);
      if (found) return found;
    }
  }

  return null;
}

function extractBookmarkNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  bookmarkId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === bookmarkId && node.url) {
      nodes.splice(i, 1);
      return node;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const extracted = extractBookmarkNodeById(node.children, bookmarkId);
      if (extracted) return extracted;
    }
  }

  return null;
}

function extractFolderNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string
): chrome.bookmarks.BookmarkTreeNode | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === folderId && Array.isArray(node.children)) {
      if (node.parentId == null) return null;
      nodes.splice(i, 1);
      return node;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const extracted = extractFolderNodeById(node.children, folderId);
      if (extracted) return extracted;
    }
  }

  return null;
}

function folderContainsFolderId(
  folderNode: chrome.bookmarks.BookmarkTreeNode,
  targetFolderId: string
): boolean {
  if (folderNode.id === targetFolderId) return true;

  const children = folderNode.children ?? [];
  for (const child of children) {
    if (!Array.isArray(child.children)) continue;
    if (folderContainsFolderId(child, targetFolderId)) return true;
  }

  return false;
}

export function moveMockBookmark(bookmarkId: string, parentId: string): boolean {
  if (!bookmarkId || !parentId) return false;

  const runtimeTree = ensureRuntimeMockTree();
  const targetFolder = findFolderNodeById(runtimeTree, parentId);
  if (!targetFolder || !Array.isArray(targetFolder.children)) return false;

  const bookmarkNode = extractBookmarkNodeById(runtimeTree, bookmarkId);
  if (!bookmarkNode) return false;

  bookmarkNode.parentId = parentId;
  targetFolder.children.push(bookmarkNode);
  return true;
}

export function moveMockFolder(folderId: string, parentId: string, index?: number): boolean {
  if (!folderId || !parentId) return false;

  const runtimeTree = ensureRuntimeMockTree();
  const folderNode = findFolderNodeById(runtimeTree, folderId);
  if (!folderNode) return false;
  if (folderNode.parentId == null) return false;
  if (folderNode.id === parentId) return false;
  if (folderContainsFolderId(folderNode, parentId)) return false;

  const targetFolder = findFolderNodeById(runtimeTree, parentId);
  if (!targetFolder) return false;
  if (!Array.isArray(targetFolder.children)) {
    targetFolder.children = [];
  }

  const extracted = extractFolderNodeById(runtimeTree, folderId);
  if (!extracted) return false;

  extracted.parentId = parentId;
  const children = targetFolder.children;
  const safeIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(children.length, Math.floor(index as number)))
    : children.length;
  children.splice(safeIndex, 0, extracted);
  return true;
}

function collectNodeIds(nodes: chrome.bookmarks.BookmarkTreeNode[], ids: Set<number>) {
  for (const node of nodes) {
    const parsed = Number(node.id);
    if (Number.isInteger(parsed) && parsed >= 0) {
      ids.add(parsed);
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      collectNodeIds(node.children, ids);
    }
  }
}

function createNextMockNodeId(nodes: chrome.bookmarks.BookmarkTreeNode[]): string {
  const ids = new Set<number>();
  collectNodeIds(nodes, ids);
  let nextId = 1;
  while (ids.has(nextId)) {
    nextId += 1;
  }
  return String(nextId);
}

export function createMockFolder(payload: MockCreateFolderPayload): boolean {
  const title = payload.title.trim();
  const parentId = payload.parentId.trim();
  const index = payload.index;
  if (!title || !parentId) return false;

  const runtimeTree = ensureRuntimeMockTree();
  const parentFolder = findFolderNodeById(runtimeTree, parentId);
  if (!parentFolder) return false;

  if (!Array.isArray(parentFolder.children)) {
    parentFolder.children = [];
  }

  const nextId = createNextMockNodeId(runtimeTree);
  const nextFolder: chrome.bookmarks.BookmarkTreeNode = {
    id: nextId,
    parentId,
    title,
    children: [],
  };

  const children = parentFolder.children;
  const safeIndex = Number.isFinite(index)
    ? Math.max(0, Math.min(children.length, Math.floor(index as number)))
    : children.length;
  children.splice(safeIndex, 0, nextFolder);
  return true;
}

function removeBookmarkNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  bookmarkId: string
): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === bookmarkId && node.url) {
      nodes.splice(i, 1);
      return true;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const removed = removeBookmarkNodeById(node.children, bookmarkId);
      if (removed) return true;
    }
  }

  return false;
}

export function removeMockBookmark(bookmarkId: string): boolean {
  if (!bookmarkId) return false;
  const runtimeTree = ensureRuntimeMockTree();
  return removeBookmarkNodeById(runtimeTree, bookmarkId);
}

function removeFolderNodeById(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  folderId: string
): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.id === folderId && Array.isArray(node.children)) {
      if (node.parentId == null) return false;
      if (node.children.length > 0) return false;
      nodes.splice(i, 1);
      return true;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      const removed = removeFolderNodeById(node.children, folderId);
      if (removed) return true;
    }
  }

  return false;
}

export function removeMockFolder(folderId: string): boolean {
  if (!folderId) return false;
  const runtimeTree = ensureRuntimeMockTree();
  return removeFolderNodeById(runtimeTree, folderId);
}
