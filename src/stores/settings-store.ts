import { usePreferredDark } from '@vueuse/core';
import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import { getFromStorage, setToStorage } from '@/services/storage-service';
import type { SearchResultView, ThemeMode, UserSettings } from '@/types/settings';
import { logError, logInfo } from '@/utils/logger';

function getDefaultSettings(): UserSettings {
  return {
    schemaVersion: 1,
    // Chrome 书签树中，书签栏通常为 1，其他书签为 2
    entryFolderId: '1',
    themeMode: 'system',
    openBehavior: 'currentTab',
    cardsPerRow: 5,
    autoRefreshBookmarks: true,
    searchResultView: 'card',
    showRecentOpened: true,
    recentOpenedRows: 3,
  };
}

function mergeSettings(stored: unknown): UserSettings {
  const defaults = getDefaultSettings();
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};

  const entryFolderId =
    typeof raw.entryFolderId === 'string' && raw.entryFolderId.trim() ? raw.entryFolderId.trim() : defaults.entryFolderId;

  const themeMode =
    raw.themeMode === 'system' || raw.themeMode === 'light' || raw.themeMode === 'dark'
      ? (raw.themeMode as ThemeMode)
      : defaults.themeMode;

  const openBehavior = raw.openBehavior === 'newTab' || raw.openBehavior === 'currentTab'
    ? raw.openBehavior
    : defaults.openBehavior;

  const cardsPerRow = clampCardsPerRow(Number(raw.cardsPerRow ?? defaults.cardsPerRow));
  const autoRefreshBookmarks = typeof raw.autoRefreshBookmarks === 'boolean'
    ? raw.autoRefreshBookmarks
    : defaults.autoRefreshBookmarks;
  const searchResultView = raw.searchResultView === 'list' || raw.searchResultView === 'card'
    ? (raw.searchResultView as SearchResultView)
    : defaults.searchResultView;
  const showRecentOpened = typeof raw.showRecentOpened === 'boolean'
    ? raw.showRecentOpened
    : defaults.showRecentOpened;
  const recentOpenedRows = resolveRecentOpenedRows(
    raw,
    cardsPerRow,
    defaults.recentOpenedRows
  );

  return {
    schemaVersion: 1,
    entryFolderId,
    themeMode,
    openBehavior,
    cardsPerRow,
    autoRefreshBookmarks,
    searchResultView,
    showRecentOpened,
    recentOpenedRows,
  };
}

function applyDarkClass(shouldUseDark: boolean) {
  const root = document.documentElement;

  if (shouldUseDark) {
    root.classList.add('dark');
    return;
  }

  root.classList.remove('dark');
}

export const useSettingsStore = defineStore('settings', () => {
  const isReady = ref(false);
  const isSaving = ref(false);
  const hasError = ref(false);
  const errorMessage = ref<string | null>(null);

  const settings = ref<UserSettings>(getDefaultSettings());
  const preferredDark = usePreferredDark();

  const shouldUseDark = computed(() => {
    const mode = settings.value.themeMode;
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return preferredDark.value;
  });

  watch(
    shouldUseDark,
    (isDark) => {
      applyDarkClass(isDark);
    },
    { immediate: true }
  );

  async function initSettings(): Promise<void> {
    try {
      hasError.value = false;
      errorMessage.value = null;

      const stored = await getFromStorage<unknown>(STORAGE_KEYS.settings);
      settings.value = mergeSettings(stored);
      logInfo('设置加载完成', settings.value);
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '设置加载失败';
      logError('设置加载失败', error);
    } finally {
      isReady.value = true;
    }
  }

  async function updateSettings(partial: Partial<UserSettings>): Promise<boolean> {
    isSaving.value = true;
    try {
      hasError.value = false;
      errorMessage.value = null;

      settings.value = mergeSettings({ ...settings.value, ...partial });
      const ok = await setToStorage(STORAGE_KEYS.settings, settings.value);
      if (!ok) {
        hasError.value = true;
        errorMessage.value = '设置保存失败';
      }
      return ok;
    } catch (error) {
      hasError.value = true;
      errorMessage.value = '设置保存失败';
      logError('设置保存失败', error);
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  return {
    // state
    isReady,
    isSaving,
    hasError,
    errorMessage,
    settings,
    // actions
    initSettings,
    updateSettings,
  };
});

function clampCardsPerRow(value: number): number {
  const safe = Number.isFinite(value) ? Math.round(value) : 5;
  return Math.max(2, Math.min(9, safe));
}

function clampRecentOpenedRows(value: number): number {
  const safe = Number.isFinite(value) ? Math.round(value) : 3;
  return Math.max(1, Math.min(6, safe));
}

function resolveRecentOpenedRows(
  raw: Record<string, unknown>,
  cardsPerRow: number,
  fallbackRows: number
): number {
  const recentOpenedRows = Number(raw.recentOpenedRows);
  if (Number.isFinite(recentOpenedRows)) {
    return clampRecentOpenedRows(recentOpenedRows);
  }

  // 兼容旧字段：recentOpenedLimit（按条数）迁移为按行数。
  const legacyLimit = Number(raw.recentOpenedLimit);
  if (Number.isFinite(legacyLimit)) {
    const perRow = Math.max(1, cardsPerRow);
    return clampRecentOpenedRows(Math.ceil(legacyLimit / perRow));
  }

  return clampRecentOpenedRows(fallbackRows);
}
