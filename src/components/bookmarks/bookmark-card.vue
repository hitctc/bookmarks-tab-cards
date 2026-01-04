<template>
  <a
    class="group block rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    :href="item.url"
    :target="target"
    rel="noopener noreferrer"
    :title="item.url"
  >
    <div class="flex items-start gap-3">
      <BookmarkAvatar :url="item.url" :title="item.title" :domain="item.domain" :size="40" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ item.title }}
        </div>
        <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {{ item.domain || item.url }}
        </div>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import type { BookmarkIndexItem } from '@/types/bookmarks';

import BookmarkAvatar from './bookmark-avatar.vue';

defineProps<{
  item: BookmarkIndexItem;
  target: '_self' | '_blank';
}>();
</script>


