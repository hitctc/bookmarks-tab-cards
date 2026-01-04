export function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || '';
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string, size = 64): string {
  const safeSize = Number.isFinite(size) ? Math.max(16, Math.min(256, size)) : 64;
  // 注意：favicon2 的参数是 page_url，不是 url
  // show_fallback_monogram=1：无 favicon 时也会返回一个可识别的 monogram（部分版本有效）
  return `chrome://favicon2/?size=${safeSize}&scale_factor=2x&show_fallback_monogram=1&page_url=${encodeURIComponent(
    url
  )}`;
}

function isChromeExtensionPage(): boolean {
  try {
    return globalThis.location?.protocol === 'chrome-extension:';
  } catch {
    return false;
  }
}

export function getFaviconFallbackUrls(url: string, size = 64): string[] {
  const safeSize = Number.isFinite(size) ? Math.max(16, Math.min(256, size)) : 64;
  const rawUrl = url.trim();
  if (!rawUrl) return [];

  const extra: string[] = [];
  // 进一步兜底：直接尝试站点根目录 favicon.ico（无需额外权限，img 会按浏览器规则请求）
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      extra.push(`${parsed.origin}/favicon.ico`);
    }
  } catch {
    // ignore
  }

  const candidates: string[] = [];
  // chrome://favicon2 仅在扩展页面可用；开发态（http/https）会被浏览器拦截，导致控制台刷屏。
  if (isChromeExtensionPage()) {
    candidates.push(getFaviconUrl(rawUrl, safeSize));
  }

  return [...candidates, ...extra];
}


