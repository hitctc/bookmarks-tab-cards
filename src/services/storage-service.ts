import { logError } from '@/utils/logger';

function isChromeStorageAvailable(): boolean {
  return !!globalThis.chrome?.storage?.local;
}

function safelyParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function getFromStorage<T>(key: string): Promise<T | null> {
  if (isChromeStorageAvailable()) {
    return await new Promise<T | null>((resolve) => {
      try {
        chrome.storage.local.get(key, (result) => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            logError('读取本地存储失败', lastError);
            resolve(null);
            return;
          }

          resolve((result?.[key] as T) ?? null);
        });
      } catch (error) {
        logError('读取本地存储异常', error);
        resolve(null);
      }
    });
  }

  // 开发态兜底：允许在非扩展环境用 localStorage 预览 UI
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) return null;
    return safelyParseJson<T>(raw);
  } catch (error) {
    logError('读取 localStorage 异常', error);
    return null;
  }
}

export async function setToStorage<T>(key: string, value: T): Promise<boolean> {
  if (isChromeStorageAvailable()) {
    return await new Promise<boolean>((resolve) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          const lastError = chrome.runtime?.lastError;
          if (lastError) {
            logError('写入本地存储失败', lastError);
            resolve(false);
            return;
          }
          resolve(true);
        });
      } catch (error) {
        logError('写入本地存储异常', error);
        resolve(false);
      }
    });
  }

  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logError('写入 localStorage 异常', error);
    return false;
  }
}


