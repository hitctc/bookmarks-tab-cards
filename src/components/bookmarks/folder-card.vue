<template>
  <button
    class="group block w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    type="button"
    @click="handleOpen"
  >
    <div class="relative aspect-video bg-slate-100 dark:bg-slate-800">
      <div class="flex h-full w-full items-center justify-center text-slate-600 dark:text-slate-200">
        <FolderOutlined class="text-3xl" />
      </div>
    </div>

    <div class="flex items-start justify-between gap-3 p-3">
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {{ folder.title }}
        </div>
        <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
          {{ countText }}
        </div>
      </div>
      <div class="mt-0.5 text-slate-400 transition group-hover:text-slate-600 dark:group-hover:text-slate-200">
        <RightOutlined />
      </div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { FolderOutlined, RightOutlined } from '@ant-design/icons-vue';
import { computed } from 'vue';

import type { BookmarkFolderNode } from '@/types/bookmarks';

const props = defineProps<{
  folder: BookmarkFolderNode;
}>();

const emit = defineEmits<{
  (event: 'open', folderId: string): void;
}>();

const countText = computed(() => {
  const folderCount = props.folder.childFolderIds.length;
  const bookmarkCount = props.folder.childBookmarkIds.length;
  return `${folderCount} 个文件夹 / ${bookmarkCount} 个书签`;
});

function handleOpen() {
  emit('open', props.folder.id);
}
</script>


