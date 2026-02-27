import type { BookmarkIndexItem, RecentBookmarkOpenRecord } from '@/types/bookmarks';
import { normalizeSearchText } from '@/utils/text';
import { buildPinyinSearchText } from '@/utils/pinyin';

interface ScoredBookmarkItem {
  item: BookmarkIndexItem;
  score: number;
  index: number;
}

interface PinyinCacheEntry {
  fingerprint: string;
  searchText: string;
}

export interface SearchBookmarkItemsOptions {
  limit?: number;
  pinnedAtMap?: Record<string, number>;
  recentOpenMap?: Record<string, RecentBookmarkOpenRecord>;
  now?: number;
}

const CJK_CHAR_PATTERN = /[\u3400-\u9FFF]/u;
const LATIN_KEYWORD_PATTERN = /^[a-z]+$/;
const MAX_PINYIN_CACHE_ENTRIES = 6000;
const pinyinSearchCache = new Map<string, PinyinCacheEntry>();

function hasCjkChar(value: string): boolean {
  return CJK_CHAR_PATTERN.test(value);
}

function shouldTryPinyinMatch(keywords: string[]): boolean {
  return keywords.some((keyword) => LATIN_KEYWORD_PATTERN.test(keyword));
}

function trimPinyinSearchCache(): void {
  if (pinyinSearchCache.size <= MAX_PINYIN_CACHE_ENTRIES) return;

  const targetSize = Math.floor(MAX_PINYIN_CACHE_ENTRIES * 0.9);
  const removeCount = Math.max(1, pinyinSearchCache.size - targetSize);
  let removed = 0;

  for (const key of pinyinSearchCache.keys()) {
    pinyinSearchCache.delete(key);
    removed += 1;
    if (removed >= removeCount) break;
  }
}

function getItemPinyinSearchText(item: BookmarkIndexItem): string {
  if (!hasCjkChar(item.title) && !hasCjkChar(item.folderPath)) return '';

  const fingerprint = `${item.title}\n${item.folderPath}`;
  const cached = pinyinSearchCache.get(item.id);
  if (cached && cached.fingerprint === fingerprint) {
    return cached.searchText;
  }

  const searchText = buildPinyinSearchText(fingerprint);
  pinyinSearchCache.set(item.id, { fingerprint, searchText });
  trimPinyinSearchCache();
  return searchText;
}

function calculateRecencyBoost(
  itemId: string,
  recentOpenMap: Record<string, RecentBookmarkOpenRecord> | undefined,
  now: number
): number {
  const record = recentOpenMap?.[itemId];
  if (!record) return 0;

  const openedAt = Number(record.openedAt);
  const openCount = Number(record.openCount);
  if (!Number.isFinite(openedAt) || openedAt <= 0) return 0;

  const ageHours = Math.max(0, (now - openedAt) / 3600000);
  let recencyBoost = 8;
  if (ageHours <= 24) {
    recencyBoost = 32;
  } else if (ageHours <= 24 * 7) {
    recencyBoost = 20;
  } else if (ageHours <= 24 * 30) {
    recencyBoost = 12;
  }

  const countBoost = Number.isFinite(openCount) && openCount > 1 ? Math.min(20, Math.floor(openCount / 2)) : 0;
  return recencyBoost + countBoost;
}

function calculatePinBoost(itemId: string, pinnedAtMap: Record<string, number> | undefined): number {
  const pinnedAt = Number(pinnedAtMap?.[itemId] ?? 0);
  return pinnedAt > 0 ? 24 : 0;
}

function calculateMatchScore(
  item: BookmarkIndexItem,
  keywords: string[],
  fullKeyword: string,
  pinyinSearchText: string,
  options: SearchBookmarkItemsOptions
): number {
  const title = item.title.toLowerCase();
  const domain = item.domain.toLowerCase();
  const url = item.url.toLowerCase();
  const folderPath = item.folderPath.toLowerCase();

  let score = 0;

  for (const keyword of keywords) {
    if (title === keyword) {
      score += 620;
      continue;
    }
    if (title.startsWith(keyword)) {
      score += 470;
      continue;
    }
    if (title.includes(keyword)) {
      score += 340;
      continue;
    }
    if (domain.startsWith(keyword)) {
      score += 260;
      continue;
    }
    if (domain.includes(keyword)) {
      score += 210;
      continue;
    }
    if (url.includes(keyword)) {
      score += 120;
      continue;
    }
    if (folderPath.includes(keyword)) {
      score += 80;
      continue;
    }
    if (pinyinSearchText.includes(keyword)) {
      score += 180;
    }
  }

  if (fullKeyword) {
    if (title === fullKeyword) {
      score += 320;
    } else if (title.startsWith(fullKeyword)) {
      score += 260;
    } else if (title.includes(fullKeyword)) {
      score += 180;
    } else if (domain.includes(fullKeyword)) {
      score += 140;
    } else if (pinyinSearchText.includes(fullKeyword)) {
      score += 120;
    } else if (url.includes(fullKeyword)) {
      score += 90;
    } else if (folderPath.includes(fullKeyword)) {
      score += 70;
    }
  }

  const now = Number.isFinite(options.now) ? (options.now as number) : Date.now();
  score += calculatePinBoost(item.id, options.pinnedAtMap);
  score += calculateRecencyBoost(item.id, options.recentOpenMap, now);

  return score;
}

function parseKeywords(rawKeyword: string): string[] {
  const normalized = normalizeSearchText(rawKeyword);
  if (!normalized) return [];

  const tokens = normalized.split(' ').filter((part) => part.length > 0);
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (seen.has(token)) continue;
    seen.add(token);
    deduped.push(token);
  }

  return deduped;
}

function containsAllKeywords(text: string, keywords: string[]): boolean {
  for (const keyword of keywords) {
    if (!text.includes(keyword)) return false;
  }
  return true;
}

function isHigherRank(a: ScoredBookmarkItem, b: ScoredBookmarkItem): boolean {
  return a.score > b.score || (a.score === b.score && a.index < b.index);
}

function insertIntoTopK(top: ScoredBookmarkItem[], entry: ScoredBookmarkItem, limit: number): void {
  if (top.length === 0) {
    top.push(entry);
    return;
  }

  const worst = top[top.length - 1];
  if (top.length >= limit && !isHigherRank(entry, worst)) {
    return;
  }

  let insertIndex = top.length;
  for (let i = 0; i < top.length; i += 1) {
    if (isHigherRank(entry, top[i])) {
      insertIndex = i;
      break;
    }
  }

  top.splice(insertIndex, 0, entry);
  if (top.length > limit) {
    top.pop();
  }
}

function resolveLimit(rawLimit: unknown): number {
  const limit = Number(rawLimit);
  if (!Number.isFinite(limit)) return 120;
  return Math.max(10, Math.min(500, Math.floor(limit)));
}

export function searchBookmarkItems(
  items: BookmarkIndexItem[],
  rawKeyword: string,
  options: SearchBookmarkItemsOptions = {}
): BookmarkIndexItem[] {
  const fullKeyword = normalizeSearchText(rawKeyword);
  if (!fullKeyword) return [];

  const keywords = parseKeywords(fullKeyword);
  if (keywords.length === 0) return [];

  const tryPinyinMatch = shouldTryPinyinMatch(keywords);
  const maxLimit = resolveLimit(options.limit);
  const topMatched: ScoredBookmarkItem[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    let pinyinSearchText = '';

    let isMatched = containsAllKeywords(item.searchText, keywords);
    if (!isMatched && tryPinyinMatch) {
      pinyinSearchText = getItemPinyinSearchText(item);
      if (pinyinSearchText) {
        const mergedSearchText = `${item.searchText} ${pinyinSearchText}`;
        isMatched = containsAllKeywords(mergedSearchText, keywords);
      }
    }
    if (!isMatched) continue;

    insertIntoTopK(
      topMatched,
      {
        item,
        score: calculateMatchScore(item, keywords, fullKeyword, pinyinSearchText, options),
        index: i,
      },
      maxLimit
    );
  }

  return topMatched.map((entry) => entry.item);
}
