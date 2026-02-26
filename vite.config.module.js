import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

const copyModuleAssets = {
  name: 'copy-module-assets',
  closeBundle() {
    const outDir = resolve(__dirname, 'module');
    mkdirSync(outDir, { recursive: true });
    copyFileSync(
      resolve(__dirname, 'client/content.html'),
      resolve(outDir, 'content.html')
    );
    copyFileSync(
      resolve(__dirname, 'client/pulse-chat.css'),
      resolve(outDir, 'simulation.css')
    );
    copyFileSync(
      resolve(__dirname, 'client/help-content.html'),
      resolve(outDir, 'help-content.html')
    );
  }
};

export default defineConfig({
  root: './client',
  plugins: [copyModuleAssets],
  build: {
    outDir: '../module',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'client/pulse-chat.js'),
      formats: ['es'],
      fileName: () => 'simulation.js'
    },
    rollupOptions: {
      external: [/design-system/]
    }
  }
});
