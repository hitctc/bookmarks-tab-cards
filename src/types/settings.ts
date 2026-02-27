export type ThemeMode = 'system' | 'light' | 'dark';

export type OpenBehavior = 'currentTab' | 'newTab';

export type SearchResultView = 'card' | 'list';

export interface UserSettings {
  schemaVersion: 1;
  entryFolderId: string;
  themeMode: ThemeMode;
  openBehavior: OpenBehavior;
  cardsPerRow: number; // 2~9
  autoRefreshBookmarks: boolean;
  searchResultView: SearchResultView;
  showRecentOpened: boolean;
  recentOpenedRows: number;
}
