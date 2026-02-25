import { normalizeSearchText } from '@/utils/text';
import { pinyin } from 'pinyin-pro';

const CJK_CHAR_PATTERN = /[\u3400-\u9FFF]/u;

function getPinyinArray(value: string, pattern?: 'first'): string[] {
  return pinyin(value, {
    toneType: 'none',
    type: 'array',
    nonZh: 'removed',
    pattern,
  }).filter((part) => part.length > 0);
}

function toLoosePinyin(value: string): string {
  return value.replace(/zh/g, 'z').replace(/ch/g, 'c').replace(/sh/g, 's');
}

export function buildPinyinSearchText(value: string): string {
  if (!value || !CJK_CHAR_PATTERN.test(value)) return '';

  const pinyinParts = getPinyinArray(value);
  if (pinyinParts.length === 0) return '';

  const initialParts = getPinyinArray(value, 'first');
  const fullCompact = pinyinParts.join('');
  const fullSpaced = pinyinParts.join(' ');
  const fullCompactLoose = toLoosePinyin(fullCompact);
  const fullSpacedLoose = toLoosePinyin(fullSpaced);
  const initialCompact = initialParts.join('');
  const initialSpaced = initialParts.join(' ');

  return normalizeSearchText(
    `${fullCompact} ${fullSpaced} ${fullCompactLoose} ${fullSpacedLoose} ${initialCompact} ${initialSpaced}`
  );
}
