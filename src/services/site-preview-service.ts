import { logError } from '@/utils/logger';

interface SitePreviewRecord {
  url: string;
  updatedAt: number;
  dataUrl: string; // 建议存 webp，体积更小
}

interface CapturePreviewOptions {
  maxWidth?: number;
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
  quality?: number; // 0~1，仅对 webp/jpeg 生效
}

const DB_NAME = 'btc_site_previews_v1';
const DB_VERSION = 1;
const STORE_NAME = 'previews';
const INDEX_UPDATED_AT = 'updatedAt';
const MAX_CACHE_ITEMS = 300;

let dbPromise: Promise<IDBDatabase> | null = null;

// 截图 API 不适合并发调用（容易抢同一帧/同一窗口），这里做一个最小队列
let captureChain: Promise<unknown> = Promise.resolve();

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = openDb();
  return dbPromise;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        const tx = request.transaction;
        if (!tx) return;

        const store = db.objectStoreNames.contains(STORE_NAME)
          ? tx.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'url' });

        if (!store.indexNames.contains(INDEX_UPDATED_AT)) {
          store.createIndex(INDEX_UPDATED_AT, INDEX_UPDATED_AT, { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } catch (error) {
      reject(error);
    }
  });
}

function queueCapture<T>(task: () => Promise<T>): Promise<T> {
  const next = captureChain.then(task, task) as Promise<T>;
  captureChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function isChromeCaptureAvailable(): boolean {
  return !!globalThis.chrome?.tabs?.captureVisibleTab;
}

function captureVisibleTabPng(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isChromeCaptureAvailable()) {
      reject(new Error('截图能力不可用'));
      return;
    }

    try {
      // 兼容不同的 TS overload：这里用 any 避免因为 windowId 参数导致的类型不一致
      (chrome.tabs.captureVisibleTab as any)({ format: 'png' }, (dataUrl: string) => {
        const lastError = chrome.runtime?.lastError;
        if (lastError) {
          reject(lastError);
          return;
        }
        if (!dataUrl) {
          reject(new Error('未获取到截图数据'));
          return;
        }
        resolve(dataUrl);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('截图图片加载失败'));
      img.src = src;
    } catch (error) {
      reject(error);
    }
  });
}

export async function getSitePreviewFromCache(url: string): Promise<string | null> {
  const safeUrl = url?.trim();
  if (!safeUrl) return null;

  try {
    const db = await getDb();
    return await new Promise<string | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(safeUrl);

      req.onsuccess = () => {
        const record = req.result as SitePreviewRecord | undefined;
        resolve(record?.dataUrl ?? null);
      };
      req.onerror = () => {
        logError('读取预览图缓存失败', req.error);
        resolve(null);
      };
    });
  } catch (error) {
    logError('打开预览图缓存失败', error);
    return null;
  }
}

export async function setSitePreviewToCache(url: string, dataUrl: string): Promise<boolean> {
  const safeUrl = url?.trim();
  const safeDataUrl = dataUrl?.trim();
  if (!safeUrl || !safeDataUrl) return false;

  try {
    const db = await getDb();
    const record: SitePreviewRecord = {
      url: safeUrl,
      updatedAt: Date.now(),
      dataUrl: safeDataUrl,
    };

    const ok = await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);

      req.onsuccess = () => resolve(true);
      req.onerror = () => {
        logError('写入预览图缓存失败', req.error);
        resolve(false);
      };
    });

    if (ok) void pruneOldCache(db, MAX_CACHE_ITEMS);
    return ok;
  } catch (error) {
    logError('写入预览图缓存异常', error);
    return false;
  }
}

async function pruneOldCache(db: IDBDatabase, maxItems: number): Promise<void> {
  if (!Number.isFinite(maxItems) || maxItems <= 0) return;

  try {
    const total = await new Promise<number>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();
      req.onsuccess = () => resolve(Number(req.result || 0));
      req.onerror = () => resolve(0);
    });

    if (total <= maxItems) return;
    const deleteCount = total - maxItems;

    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index(INDEX_UPDATED_AT);

      let deleted = 0;
      const req = index.openCursor();

      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || deleted >= deleteCount) return;
        try {
          cursor.delete();
          deleted += 1;
          cursor.continue();
        } catch {
          // ignore
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch (error) {
    logError('清理预览图缓存失败', error);
  }
}

export async function captureElementPreviewDataUrl(
  element: HTMLElement,
  options: CapturePreviewOptions = {}
): Promise<string | null> {
  return await queueCapture(async () => {
    try {
      if (!element?.isConnected) return null;

      const rect = element.getBoundingClientRect();
      if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
        return null;
      }

      const screenshot = await captureVisibleTabPng();
      const img = await loadImage(screenshot);

      const dpr = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
      const sx = Math.max(0, rect.left * dpr);
      const sy = Math.max(0, rect.top * dpr);
      const sw = Math.min(img.width - sx, rect.width * dpr);
      const sh = Math.min(img.height - sy, rect.height * dpr);

      if (sw <= 0 || sh <= 0) return null;

      const maxWidth = Number.isFinite(options.maxWidth) ? Math.max(240, Math.min(1200, options.maxWidth!)) : 640;
      const scale = sw > maxWidth ? maxWidth / sw : 1;
      const targetW = Math.max(1, Math.round(sw * scale));
      const targetH = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

      const format = options.format ?? 'image/webp';
      const quality = Number.isFinite(options.quality) ? Math.max(0.3, Math.min(0.95, options.quality!)) : 0.82;

      if (format === 'image/png') return canvas.toDataURL('image/png');
      return canvas.toDataURL(format, quality);
    } catch (error) {
      logError('生成预览图失败', error);
      return null;
    }
  });
}


