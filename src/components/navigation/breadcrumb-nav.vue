<template>
  <div class="flex flex-wrap items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
    <button
      v-if="canGoBack"
      class="mr-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700"
      type="button"
      @click="emit('back')"
    >
      返回
    </button>

    <template v-for="(folder, index) in folders" :key="folder.id">
      <button
        class="max-w-[220px] truncate rounded px-1 py-0.5 hover:bg-slate-100 dark:hover:bg-slate-800"
        type="button"
        :title="folder.title"
        @click="emit('navigate', folder.id)"
      >
        {{ folder.title }}
      </button>
      <span v-if="index < folders.length - 1" class="text-slate-400">/</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { BookmarkFolderNode } from '@/types/bookmarks';

defineProps<{
  folders: BookmarkFolderNode[];
  canGoBack: boolean;
}>();

const emit = defineEmits<{
  (event: 'navigate', folderId: string): void;
  (event: 'back'): void;
}>();
</script>


