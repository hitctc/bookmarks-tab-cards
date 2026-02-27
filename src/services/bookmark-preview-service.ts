interface SiteCoverAdapter {
  id: 'github' | 'youtube' | 'zhihu';
  badgeText: string;
  subtitle: string;
  fallbackLetter: string;
  coverStyle: Record<string, string>;
}

const DEFAULT_SMART_STYLE: Record<string, string> = {
  backgroundColor: '#1e293b',
  backgroundImage:
    'radial-gradient(120% 120% at 100% 0%, rgba(125,211,252,0.32) 0%, transparent 56%), linear-gradient(135deg, #334155, #0f172a)',
};

const GITHUB_COVER_STYLE: Record<string, string> = {
  backgroundColor: '#0f172a',
  backgroundImage:
    'radial-gradient(120% 130% at 100% -10%, rgba(56,189,248,0.3) 0%, transparent 58%), linear-gradient(140deg, #0f172a 0%, #1e293b 45%, #0b1220 100%)',
};

const YOUTUBE_COVER_STYLE: Record<string, string> = {
  backgroundColor: '#7f1d1d',
  backgroundImage:
    'radial-gradient(120% 130% at 105% -10%, rgba(252,165,165,0.34) 0%, transparent 58%), linear-gradient(138deg, #7f1d1d 0%, #b91c1c 45%, #0f172a 100%)',
};

const ZHIHU_COVER_STYLE: Record<string, string> = {
  backgroundColor: '#1d4ed8',
  backgroundImage:
    'radial-gradient(120% 130% at 108% -8%, rgba(125,211,252,0.34) 0%, transparent 60%), linear-gradient(138deg, #1d4ed8 0%, #1e40af 44%, #0f172a 100%)',
};

export function resolveSiteCoverAdapter(url: string): SiteCoverAdapter | null {
  const parsed = safelyParseUrl(url);
  if (!parsed) return null;

  const host = normalizeHost(parsed.hostname);
  if (isGitHubHost(host)) {
    return {
      id: 'github',
      badgeText: 'GitHub',
      subtitle: resolveGitHubSubtitle(parsed),
      fallbackLetter: 'GH',
      coverStyle: GITHUB_COVER_STYLE,
    };
  }

  if (isYouTubeHost(host)) {
    return {
      id: 'youtube',
      badgeText: 'YouTube',
      subtitle: resolveYouTubeSubtitle(parsed),
      fallbackLetter: 'YT',
      coverStyle: YOUTUBE_COVER_STYLE,
    };
  }

  if (isZhihuHost(host)) {
    return {
      id: 'zhihu',
      badgeText: '知乎',
      subtitle: resolveZhihuSubtitle(parsed),
      fallbackLetter: '知',
      coverStyle: ZHIHU_COVER_STYLE,
    };
  }

  return null;
}

export function buildSmartPseudoCoverStyle(seed: string): Record<string, string> {
  const safeSeed = seed.trim().toLowerCase();
  if (!safeSeed) return DEFAULT_SMART_STYLE;

  const hash = hashToUint32(safeSeed);
  const altHash = hashToUint32(`${safeSeed}::alt`);
  const glowHash = hashToUint32(`${safeSeed}::glow`);

  const hueA = hash % 360;
  let hueB = altHash % 360;
  if (minHueDiff(hueA, hueB) < 24) {
    hueB = (hueA + 28 + (altHash % 112)) % 360;
  }
  const hueGlow = (hueB + 12 + (glowHash % 48)) % 360;

  const satA = 54 + (hash % 18);
  const satB = 42 + (altHash % 20);
  const satGlow = 62 + (glowHash % 18);

  const lightA = 46 + (hash % 12);
  const lightB = 28 + (altHash % 11);
  const lightGlow = 68 + (glowHash % 12);

  return {
    backgroundColor: `hsl(${hueA}, ${Math.max(30, satB - 10)}%, ${Math.max(16, lightB - 10)}%)`,
    backgroundImage: [
      `radial-gradient(120% 130% at 110% -10%, hsla(${hueGlow}, ${satGlow}%, ${lightGlow}%, 0.34) 0%, transparent 58%)`,
      `radial-gradient(92% 108% at -12% 118%, hsla(${hueA}, ${Math.min(86, satA + 8)}%, ${Math.min(78, lightA + 12)}%, 0.24) 0%, transparent 62%)`,
      `linear-gradient(138deg, hsl(${hueA}, ${satA}%, ${lightA}%), hsl(${hueB}, ${satB}%, ${lightB}%))`,
    ].join(', '),
  };
}

function safelyParseUrl(url: string): URL | null {
  const raw = url.trim();
  if (!raw) return null;

  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

function isGitHubHost(host: string): boolean {
  return host === 'github.com' || host === 'gist.github.com';
}

function isYouTubeHost(host: string): boolean {
  return host === 'youtu.be' || host === 'youtube.com' || host.endsWith('.youtube.com');
}

function isZhihuHost(host: string): boolean {
  return host === 'zhihu.com' || host.endsWith('.zhihu.com');
}

function resolveGitHubSubtitle(parsed: URL): string {
  const parts = splitPath(parsed.pathname);
  if (parts.length >= 2) {
    const owner = decodeSegment(parts[0]);
    const repo = decodeSegment(parts[1]);
    const repoScope = `${owner}/${repo}`;

    const kind = parts[2];
    const id = parts[3];
    if (kind === 'issues' && id) return `${repoScope} · Issue #${id}`;
    if (kind === 'pull' && id) return `${repoScope} · PR #${id}`;
    if (kind === 'actions') return `${repoScope} · Actions`;
    if (kind === 'discussions') return `${repoScope} · Discussions`;
    return repoScope;
  }

  if (parts[0]) return decodeSegment(parts[0]);
  return 'github.com';
}

function resolveYouTubeSubtitle(parsed: URL): string {
  const host = normalizeHost(parsed.hostname);
  const parts = splitPath(parsed.pathname);

  if (host === 'youtu.be' && parts[0]) {
    return `视频 · ${clipIdentifier(parts[0])}`;
  }

  if (parts[0] === 'watch') {
    const videoId = parsed.searchParams.get('v');
    if (videoId) return `视频 · ${clipIdentifier(videoId)}`;
  }

  if (parts[0] === 'shorts' && parts[1]) {
    return `Shorts · ${clipIdentifier(parts[1])}`;
  }

  if (parts[0] === 'playlist') {
    const listId = parsed.searchParams.get('list');
    if (listId) return `播放列表 · ${clipIdentifier(listId)}`;
  }

  if (parts[0] && parts[0].startsWith('@')) {
    return `频道 · ${decodeSegment(parts[0])}`;
  }

  if (parts[0] === 'channel' && parts[1]) {
    return `频道 · ${clipIdentifier(parts[1])}`;
  }

  return 'youtube.com';
}

function resolveZhihuSubtitle(parsed: URL): string {
  const parts = splitPath(parsed.pathname);
  if (parts[0] === 'question' && parts[1]) {
    return `问题 #${clipIdentifier(parts[1], 18)}`;
  }

  if (parts[0] === 'p' && parts[1]) {
    return `专栏 #${clipIdentifier(parts[1], 18)}`;
  }

  if (parts[0] === 'column' && parts[1]) {
    return `专栏 · ${decodeSegment(parts[1])}`;
  }

  if (parts[0] && parts[0].startsWith('@')) {
    return `用户 · ${decodeSegment(parts[0])}`;
  }

  return 'zhihu.com';
}

function splitPath(pathname: string): string[] {
  return pathname
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function decodeSegment(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function clipIdentifier(value: string, max = 16): string {
  const safe = value.trim();
  if (!safe) return '';
  if (safe.length <= max) return safe;
  return `${safe.slice(0, max)}…`;
}

function minHueDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function hashToUint32(input: string): number {
  // FNV-1a 32-bit：速度快、分布稳定，适合视觉种子。
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
