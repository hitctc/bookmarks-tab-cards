import { usePreferredDark } from '@vueuse/core';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import { STORAGE_KEYS } from '@/constants/storage-keys';
import { getFromStorage, setToStorage } from '@/services/storage-service';
import type { ThemeMode, UserSettings } from '@/types/settings';
import { logError, logInfo } from '@/utils/logger';

function getDefaultSettings(): UserSettings {
  return {
    schemaVersion: 1,
    // Chrome 书签树中，书签栏通常为 1，其他书签为 2
    entryFolderId: '1',
    themeMode: 'system',
    openBehavior: 'currentTab',
  };
}

function mergeSettings(stored: UserSettings | null): UserSettings {
  const defaults = getDefaultSettings();
  if (!stored) return defaults;

  return {
    ...defaults,
    ...stored,
    schemaVersion: 1,
  };
}

function applyThemeMode(themeMode: ThemeMode, isSystemDark: boolean) {
  const shouldUseDark = themeMode === 'dark' || (themeMode === 'system' && isSystemDark);
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

  watch(
    [() => settings.value.themeMode, preferredDark],
    ([themeMode, isSystemDark]) => {
      applyThemeMode(themeMode, isSystemDark);
    },
    { immediate: true }
  );

  async function initSettings(): Promise<void> {
    try {
      hasError.value = false;
      errorMessage.value = null;

      const stored = await getFromStorage<UserSettings>(STORAGE_KEYS.settings);
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


