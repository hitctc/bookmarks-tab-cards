export function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || '';
  } catch {
    return '';
  }
}

export function getFaviconUrl(url: string, size = 64): string {
  return getExtensionFaviconUrl(url, size) ?? '';
}

function getExtensionFaviconUrl(url: string, size = 64): string | null {
  const safeSize = Number.isFinite(size) ? Math.max(16, Math.min(256, size)) : 64;
  const rawUrl = url.trim();
  if (!rawUrl) return null;

  try {
    const getURL = globalThis.chrome?.runtime?.getURL;
    if (typeof getURL !== 'function') return null;

    // 使用 Chrome 扩展内置的 favicon 资源路径，避免 chrome://favicon2 的加载限制。
    const base = getURL('/_favicon/');
    const parsed = new URL(base);
    parsed.searchParams.set('pageUrl', rawUrl);
    parsed.searchParams.set('size', String(safeSize));
    return parsed.toString();
  } catch {
    return null;
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
  const extensionFaviconUrl = getExtensionFaviconUrl(rawUrl, safeSize);
  if (extensionFaviconUrl) candidates.push(extensionFaviconUrl);

  return [...candidates, ...extra];
}

