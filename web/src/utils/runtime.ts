const isStaticDeploy = import.meta.env.VITE_STATIC_DEPLOY === 'true'
const apiBase = import.meta.env.VITE_API_BASE || ''
const baseUrl = import.meta.env.BASE_URL || '/'
const repoUrl = import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/roc-nju/news-box'

function joinBasePath(path: string) {
  return `${baseUrl}${path.replace(/^\/+/, '')}`
}

export const runtimeConfig = {
  apiBase,
  baseUrl,
  isStaticDeploy,
  repoUrl,
  staticDataUrl: (fileName: string) => joinBasePath(`data/${fileName}`),
}
