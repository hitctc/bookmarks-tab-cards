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
      :title="props.isPinned ? '取消置顶' : '置顶书签'"
      :aria-label="props.isPinned ? '取消置顶' : '置顶书签'"
      class="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md shadow-md ring-1 ring-black/10 backdrop-blur-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
      :class="
        props.isPinned
          ? 'pointer-events-auto h-7 gap-1 bg-amber-100/95 px-2 text-amber-700 opacity-100 dark:bg-amber-200/20 dark:text-amber-200'
          : 'pointer-events-none h-7 w-7 bg-white/90 text-slate-700 opacity-0 hover:bg-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900'
      "
      @click="handleTogglePinClick"
    >
      <template v-if="props.isPinned">
        <PushpinFilled />
        <span class="text-[11px] font-medium leading-none">置顶</span>
      </template>
      <PushpinOutlined v-else />
    </button>

    <button
      type="button"
      title="编辑书签"
      aria-label="编辑书签"
      class="pointer-events-none absolute top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 opacity-0 shadow-md ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
      :class="props.isPinned ? 'right-[66px]' : 'right-[38px]'"
      @click="handleEditClick"
    >
      <EditOutlined />
    </button>
  </div>
</template>

<script setup lang="ts">
import { EditOutlined, PushpinFilled, PushpinOutlined } from '@ant-design/icons-vue';
import type { BookmarkIndexItem } from '@/types/bookmarks';

import BookmarkCover from './bookmark-cover.vue';

const props = withDefaults(
  defineProps<{
    item: BookmarkIndexItem;
    target: '_self' | '_blank';
    highlightQuery?: string;
    isPinned?: boolean;
  }>(),
  {
    highlightQuery: '',
    isPinned: false,
  }
);

const emit = defineEmits<{
  (event: 'edit', item: BookmarkIndexItem): void;
  (event: 'toggle-pin', item: BookmarkIndexItem): void;
}>();

function handleEditClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('edit', props.item);
}

function handleTogglePinClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('toggle-pin', props.item);
}
</script>
