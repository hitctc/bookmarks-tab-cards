import type { BookmarkIndexItem } from '@/types/bookmarks';
import { normalizeSearchText } from '@/utils/text';

interface ScoredBookmarkItem {
  item: BookmarkIndexItem;
  score: number;
  index: number;
}

function calculateMatchScore(item: BookmarkIndexItem, keyword: string): number {
  const title = item.title.toLowerCase();
  const domain = item.domain.toLowerCase();
  const url = item.url.toLowerCase();

  if (title.startsWith(keyword)) return 400;
  if (title.includes(keyword)) return 300;
  if (domain.includes(keyword)) return 200;
  if (url.includes(keyword)) return 100;
  return 0;
}

export function searchBookmarkItems(
  items: BookmarkIndexItem[],
  rawKeyword: string,
  limit = 120
): BookmarkIndexItem[] {
  const keyword = normalizeSearchText(rawKeyword);
  if (!keyword) return [];

  const maxLimit = Number.isFinite(limit) ? Math.max(10, Math.min(500, limit)) : 120;
  const matched: ScoredBookmarkItem[] = [];

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item.searchText.includes(keyword)) continue;

    matched.push({
      item,
      score: calculateMatchScore(item, keyword),
      index: i,
    });
  }

  matched.sort((a, b) => b.score - a.score || a.index - b.index);
  return matched.slice(0, maxLimit).map((x) => x.item);
}


