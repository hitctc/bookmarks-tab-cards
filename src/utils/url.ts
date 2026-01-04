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
  return `chrome://favicon2/?size=${safeSize}&url=${encodeURIComponent(url)}`;
}


