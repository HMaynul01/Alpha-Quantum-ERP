import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { copyFileSync, mkdirSync, existsSync } from 'fs'

// Plugin to copy landing page to dist
function copyLandingPlugin() {
  return {
    name: 'copy-landing',
    closeBundle() {
      try {
        const dir = 'dist/landing'
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        copyFileSync('landing/index.html', 'dist/landing/index.html')
        // Copy logo if exists
        try { copyFileSync('landing/logo.png', 'dist/landing/logo.png') } catch {}
        console.log('✓ Landing page copied to dist/landing/')
      } catch(e) { console.warn('Landing copy warn:', e) }
    }
  }
}

export default defineConfig({
  plugins: [react(), copyLandingPlugin()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom', 'react-router-dom'],
          charts:  ['recharts'],
        }
      }
    }
  }
})
