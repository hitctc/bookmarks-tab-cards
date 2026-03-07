<template>
  <div class="editorial-breadcrumb flex flex-wrap items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
    <button
      v-if="canGoBack"
      class="mr-2 rounded-lg border border-[#dfd1bf] bg-white/90 px-2.5 py-1 text-xs text-[#5c4732] transition duration-200 hover:border-[#b59b7a] hover:bg-[#f7f2ea] dark:border-[#4f4438] dark:bg-slate-900/85 dark:text-[#e5d5c0] dark:hover:border-[#8e785f]"
      type="button"
      @click="emit('back')"
    >
      返回
    </button>

    <template v-for="(folder, index) in folders" :key="folder.id">
      <button
        class="max-w-[220px] truncate rounded-md px-1.5 py-0.5 text-[#5f4a35] transition duration-200 hover:bg-[#f6efe6] dark:text-[#d6c1a6] dark:hover:bg-[#332a21]"
        type="button"
        :title="folder.title"
        @click="emit('navigate', folder.id)"
      >
        {{ folder.title }}
      </button>
      <span v-if="index < folders.length - 1" class="text-[#b39d83] dark:text-[#7f6c58]">/</span>
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

