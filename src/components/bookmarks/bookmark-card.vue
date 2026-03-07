<template>
  <div class="editorial-bookmark-card group relative w-full">
    <a
      class="block w-full overflow-hidden rounded-2xl border border-slate-200/85 bg-white/95 transition duration-300 hover:-translate-y-0.5 hover:border-[#b59b7a]/60 hover:shadow-[0_16px_36px_-24px_rgba(55,43,32,0.55)] dark:border-slate-800/80 dark:bg-slate-900/85 dark:hover:border-[#6e5b49]"
      :href="item.url"
      :target="target"
      rel="noopener noreferrer"
      :title="item.url"
      @click="handleOpenClick"
    >
      <div class="aspect-[21/9] bg-slate-100 dark:bg-slate-800">
        <BookmarkCover
          :url="item.url"
          :title="item.title"
          :highlight-query="highlightQuery"
          :open-count="props.openCount"
          :show-open-count="props.showOpenCount"
        />
      </div>
    </a>

    <button
      type="button"
      :title="props.isPinned ? '取消置顶' : '置顶书签'"
      :aria-label="props.isPinned ? '取消置顶' : '置顶书签'"
      class="absolute right-2 top-2 z-10 inline-flex items-center justify-center rounded-md shadow-md ring-1 ring-black/10 backdrop-blur-sm transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e6f4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950"
      :class="
        props.isPinned
          ? 'pointer-events-auto h-7 gap-1 bg-[#f0e5d8]/95 px-2 text-[#74563b] opacity-100 dark:bg-[#4b3c30]/55 dark:text-[#e0c8aa]'
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
      class="pointer-events-none absolute top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 opacity-0 shadow-md ring-1 ring-black/10 backdrop-blur-sm transition duration-200 hover:bg-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e6f4f] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
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
    openCount?: number;
    showOpenCount?: boolean;
  }>(),
  {
    highlightQuery: '',
    isPinned: false,
    openCount: 0,
    showOpenCount: true,
  }
);

const emit = defineEmits<{
  (event: 'edit', item: BookmarkIndexItem): void;
  (event: 'toggle-pin', item: BookmarkIndexItem): void;
  (event: 'open', item: BookmarkIndexItem): void;
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

function handleOpenClick() {
  emit('open', props.item);
}
</script>
