<template>
  <div class="group relative w-full">
    <a
      class="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      :href="item.url"
      :target="target"
      rel="noopener noreferrer"
      :title="item.url"
    >
      <div class="aspect-[21/9] bg-slate-100 dark:bg-slate-800">
        <BookmarkCover :url="item.url" :title="item.title" :highlight-query="highlightQuery" />
      </div>
    </a>

    <button
      type="button"
      title="编辑书签"
      aria-label="编辑书签"
      class="pointer-events-none absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 opacity-0 shadow-md ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
      @click="handleEditClick"
    >
      <EditOutlined />
    </button>
  </div>
</template>

<script setup lang="ts">
import { EditOutlined } from '@ant-design/icons-vue';
import type { BookmarkIndexItem } from '@/types/bookmarks';

import BookmarkCover from './bookmark-cover.vue';

const props = withDefaults(
  defineProps<{
    item: BookmarkIndexItem;
    target: '_self' | '_blank';
    highlightQuery?: string;
  }>(),
  {
    highlightQuery: '',
  }
);

const emit = defineEmits<{
  (event: 'edit', item: BookmarkIndexItem): void;
}>();

function handleEditClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('edit', props.item);
}
</script>
