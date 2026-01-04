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
            if (id.includes('ant-design-vue') || id.includes('@ant-design')) return 'ui';
            if (id.includes('vue')) return 'vue';
            return 'vendor';
          },
        },
      },
    },
  };
});


