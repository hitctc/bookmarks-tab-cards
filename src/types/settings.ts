export type ThemeMode = 'system' | 'light' | 'dark';

export type OpenBehavior = 'currentTab' | 'newTab';

export interface UserSettings {
  schemaVersion: 1;
  entryFolderId: string;
  themeMode: ThemeMode;
  openBehavior: OpenBehavior;
}


