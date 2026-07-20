import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The viewer is bundled into ../viewer-dist and shipped inside the npm package.
// Relative base so the exported static site works from file:// and subpaths.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '..', 'viewer-dist'),
    emptyOutDir: true,
  },
});
