<template>
  <div class="group relative w-full">
    <button
      class="block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
      type="button"
      @click="handleOpen"
    >
      <div class="relative aspect-[21/9] overflow-hidden" :style="coverStyle">
        <div class="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/45" />

        <div
          v-if="countBadge"
          class="absolute right-2 top-2 rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur dark:bg-slate-900/70 dark:text-slate-100"
        >
          {{ countBadge }}
        </div>

        <div class="absolute inset-x-0 bottom-0 p-2.5">
          <div class="flex items-center gap-2 rounded-md bg-white/14 px-2 py-1.5 backdrop-blur-sm">
            <FolderOutlined class="text-sm text-white/90" />
            <div class="min-w-0 flex-1 truncate text-sm font-semibold text-white">
              {{ folderTitle }}
            </div>
          </div>
        </div>
      </div>
    </button>

    <button
      type="button"
      title="编辑目录"
      aria-label="编辑目录"
      class="pointer-events-none absolute left-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-slate-700 opacity-0 shadow-md ring-1 ring-black/10 backdrop-blur-sm transition hover:bg-white group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-slate-900/85 dark:text-slate-100 dark:hover:bg-slate-900 dark:focus-visible:ring-offset-slate-950"
      @click="handleEditClick"
    >
      <EditOutlined />
    </button>
  </div>
</template>

<script setup lang="ts">
import { EditOutlined, FolderOutlined } from '@ant-design/icons-vue';
import { computed } from 'vue';

import type { BookmarkFolderNode } from '@/types/bookmarks';

const props = defineProps<{
  folder: BookmarkFolderNode;
}>();

const emit = defineEmits<{
  (event: 'open', folderId: string): void;
  (event: 'edit', folder: BookmarkFolderNode): void;
}>();

const folderTitle = computed(() => {
  const title = props.folder.title.trim();
  return title || '未命名文件夹';
});

const countBadge = computed(() => {
  const folderCount = props.folder.childFolderIds.length;
  const bookmarkCount = props.folder.childBookmarkIds.length;
  const tokens: string[] = [];
  if (folderCount > 0) tokens.push(`夹:${folderCount}`);
  if (bookmarkCount > 0) tokens.push(`书签:${bookmarkCount}`);
  return tokens.join('/');
});

const coverStyle = computed(() => buildFolderCoverStyle(`${props.folder.id}:${folderTitle.value}`));

function buildFolderCoverStyle(seed: string): Record<string, string> {
  const hash = hashToUint32(seed);
  const h1 = 205 + (hash % 20);
  const h2 = h1 + 12 + ((hash >>> 5) % 10);
  const s1 = 20 + (hash % 6);
  const s2 = 14 + ((hash >>> 3) % 5);
  const l1 = 54 + ((hash >>> 7) % 4);
  const l2 = 38 + ((hash >>> 11) % 5);

  return {
    backgroundImage: `linear-gradient(135deg, hsl(${h1}, ${s1}%, ${l1}%), hsl(${h2}, ${s2}%, ${l2}%))`,
  };
}

function hashToUint32(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function handleOpen() {
  emit('open', props.folder.id);
}

function handleEditClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('edit', props.folder);
}
</script>
