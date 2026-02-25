import type { BookmarkIndexItem } from '@/types/bookmarks';
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

const CJK_CHAR_PATTERN = /[\u3400-\u9FFF]/u;
const LATIN_KEYWORD_PATTERN = /^[a-z]+$/;
const pinyinSearchCache = new Map<string, PinyinCacheEntry>();

function hasCjkChar(value: string): boolean {
  return CJK_CHAR_PATTERN.test(value);
}

function shouldTryPinyinMatch(keywords: string[]): boolean {
  return keywords.some((keyword) => LATIN_KEYWORD_PATTERN.test(keyword));
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
  return searchText;
}

function calculateMatchScore(
  item: BookmarkIndexItem,
  keywords: string[],
  fullKeyword: string,
  pinyinSearchText = ''
): number {
  const title = item.title.toLowerCase();
  const domain = item.domain.toLowerCase();
  const url = item.url.toLowerCase();

  let score = 0;

  for (const keyword of keywords) {
    if (title.startsWith(keyword)) {
      score += 400;
      continue;
    }
    if (title.includes(keyword)) {
      score += 300;
      continue;
    }
    if (domain.includes(keyword)) {
      score += 200;
      continue;
    }
    if (url.includes(keyword)) {
      score += 100;
      continue;
    }
    if (pinyinSearchText.includes(keyword)) {
      score += 160;
    }
  }

  // 额外给“完整短语命中”一点加权，避免多词时排序过于离散。
  if (fullKeyword && title.includes(fullKeyword)) {
    score += 120;
  } else if (fullKeyword && domain.includes(fullKeyword)) {
    score += 80;
  } else if (fullKeyword && pinyinSearchText.includes(fullKeyword)) {
    score += 60;
  } else if (fullKeyword && url.includes(fullKeyword)) {
    score += 40;
  }

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

export function searchBookmarkItems(
  items: BookmarkIndexItem[],
  rawKeyword: string,
  limit = 120
): BookmarkIndexItem[] {
  const fullKeyword = normalizeSearchText(rawKeyword);
  if (!fullKeyword) return [];

  const keywords = parseKeywords(fullKeyword);
  if (keywords.length === 0) return [];

  const tryPinyinMatch = shouldTryPinyinMatch(keywords);
  const maxLimit = Number.isFinite(limit) ? Math.max(10, Math.min(500, limit)) : 120;
  const matched: ScoredBookmarkItem[] = [];

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

    matched.push({
      item,
      score: calculateMatchScore(item, keywords, fullKeyword, pinyinSearchText),
      index: i,
    });
  }

  matched.sort((a, b) => b.score - a.score || a.index - b.index);
  return matched.slice(0, maxLimit).map((x) => x.item);
}
