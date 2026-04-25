import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: process.env.BUILD_OUT_DIR || 'dist',
  },
});
