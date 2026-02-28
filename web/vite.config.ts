import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || process.env.VITE_GITHUB_PAGES_REPO || 'news-box'
const isGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  plugins: [react()],
  base: isGitHubPages ? `/${repositoryName}/` : '/',
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
    fs: {
      allow: ['..']
    }
  },
  publicDir: path.resolve(__dirname, '../'),
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    copyPublicDir: false,
  },
})
