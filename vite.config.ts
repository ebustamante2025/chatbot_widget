import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        entryFileNames: 'widget.js',
        chunkFileNames: 'widget-[hash].js',
        assetFileNames: 'widget-[hash].[ext]'
      }
    },
    // Optimizaciones para producción
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 1000
  },
  server: {
    port: 3002,
    strictPort: true,
    host: true // Permite acceso desde fuera del contenedor
  },
  preview: {
    port: 4173,
    host: true
  }
})


