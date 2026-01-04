<template>
  <a
    class="group block overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    :href="item.url"
    :target="target"
    rel="noopener noreferrer"
    :title="item.url"
  >
    <div class="aspect-video bg-slate-100 dark:bg-slate-800">
      <BookmarkCover :url="item.url" :title="item.title" />
    </div>

    <div class="p-3">
      <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
        {{ item.title }}
      </div>
      <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
        {{ item.url }}
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { BookmarkIndexItem } from '@/types/bookmarks';

import BookmarkCover from './bookmark-cover.vue';

defineProps<{
  item: BookmarkIndexItem;
  target: '_self' | '_blank';
}>();
</script>


