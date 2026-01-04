export type ThemeMode = 'system' | 'light' | 'dark';

export type OpenBehavior = 'currentTab' | 'newTab';

export interface UserSettings {
  schemaVersion: 1;
  entryFolderId: string;
  themeMode: ThemeMode;
  openBehavior: OpenBehavior;
  cardsPerRow: number; // 5~9
  enableSitePreviews: boolean; // 是否生成站点预览图（会访问目标站点并缓存截图）
}


