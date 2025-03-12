import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/lavobot-game/',
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  publicDir: 'public',
  server: {
    host: true,
    open: true
  },
  build: {
    chunkSizeWarningLimit: 1600,
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom']
        }
      }
    }
  }
}); 