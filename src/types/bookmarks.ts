export interface BookmarkIndexItem {
  id: string;
  parentId?: string;
  title: string;
  url: string;
  folderPath: string;
  domain: string;
  searchText: string;
}

export interface BookmarkFolderNode {
  id: string;
  parentId?: string;
  title: string;
  folderPath: string;
  childFolderIds: string[];
  childBookmarkIds: string[];
}

export interface BookmarkCachePayload {
  schemaVersion: 1;
  generatedAt: number;
  folderNodes: BookmarkFolderNode[];
  bookmarkItems: BookmarkIndexItem[];
}


