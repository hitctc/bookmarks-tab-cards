<template>
  <button
    class="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    type="button"
    @click="handleOpen"
  >
    <div class="relative aspect-video overflow-hidden" :style="coverStyle">
      <div class="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/45" />

      <div
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
</template>

<script setup lang="ts">
import { FolderOutlined } from '@ant-design/icons-vue';
import { computed } from 'vue';

import type { BookmarkFolderNode } from '@/types/bookmarks';

const props = defineProps<{
  folder: BookmarkFolderNode;
}>();

const emit = defineEmits<{
  (event: 'open', folderId: string): void;
}>();

const folderTitle = computed(() => {
  const title = props.folder.title.trim();
  return title || '未命名文件夹';
});

const countBadge = computed(() => {
  const folderCount = props.folder.childFolderIds.length;
  const bookmarkCount = props.folder.childBookmarkIds.length;
  return `${folderCount}/${bookmarkCount}`;
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
</script>

