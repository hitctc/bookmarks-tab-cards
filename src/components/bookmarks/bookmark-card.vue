<template>
  <a
    class="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    :href="item.url"
    :target="target"
    rel="noopener noreferrer"
    :title="item.url"
  >
    <div class="aspect-[21/9] bg-slate-100 dark:bg-slate-800">
      <BookmarkCover :url="item.url" :title="item.title" :highlight-query="highlightQuery" />
    </div>
  </a>
</template>

<script setup lang="ts">
import type { BookmarkIndexItem } from '@/types/bookmarks';

import BookmarkCover from './bookmark-cover.vue';

withDefaults(
  defineProps<{
    item: BookmarkIndexItem;
    target: '_self' | '_blank';
    highlightQuery?: string;
  }>(),
  {
    highlightQuery: '',
  }
);
</script>
