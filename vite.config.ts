import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isDevelopmentBuild = mode !== 'production';

  return {
    // Chrome Extension 场景必须使用相对路径，确保 dist/index.html 在扩展环境可正确加载资源
    base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      target: 'es2020',
      // 扩展开发时保留 sourcemap，便于定位真实源码；发布时走默认 minify
      sourcemap: isDevelopmentBuild,
      minify: isDevelopmentBuild ? false : 'esbuild',
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            // 优先拆分 antd 相关：避免所有 UI 依赖聚合成单个超大 chunk
            if (id.includes('@ant-design/icons-vue')) return 'ui-icons';
            if (id.includes('ant-design-vue')) return 'ui-components';
            if (
              id.includes('/rc-') ||
              id.includes('/@ant-design/') ||
              id.includes('/@ctrl/') ||
              id.includes('/@emotion/')
            ) {
              return 'ui-runtime';
            }

            if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router') || id.includes('@vueuse')) {
              return 'vue';
            }
            return 'vendor';
          },
        },
      },
    },
  };
});

