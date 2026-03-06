const ADMIN_AUTH_STORAGE_KEY = 'news-box.admin.auth'
const ADMIN_AUTH_CHANGED_EVENT = 'news-box-admin-auth-changed'

export interface AdminCredentials {
  username: string
  password: string
}

export function getAdminCredentials(): AdminCredentials | null {
  if (typeof window === 'undefined') return null

  const raw = window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<AdminCredentials>
    if (!parsed.username || !parsed.password) return null
    return {
      username: parsed.username,
      password: parsed.password,
    }
  } catch {
    return null
  }
}

export function setAdminCredentials(credentials: AdminCredentials) {
  window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, JSON.stringify(credentials))
  window.dispatchEvent(new Event(ADMIN_AUTH_CHANGED_EVENT))
}

export function clearAdminCredentials() {
  window.sessionStorage.removeItem(ADMIN_AUTH_STORAGE_KEY)
  window.dispatchEvent(new Event(ADMIN_AUTH_CHANGED_EVENT))
}

export function buildAdminAuthHeader(credentials: AdminCredentials) {
  return `Basic ${window.btoa(`${credentials.username}:${credentials.password}`)}`
}

export function subscribeAdminAuthChange(listener: () => void) {
  window.addEventListener(ADMIN_AUTH_CHANGED_EVENT, listener)
  return () => window.removeEventListener(ADMIN_AUTH_CHANGED_EVENT, listener)
}
