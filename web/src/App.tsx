import { useEffect, useState, type FormEvent } from 'react'
import { LockKeyhole, LogOut, Newspaper } from 'lucide-react'

import { AdminDashboard } from './components/AdminDashboard'
import { NewsDashboard } from './components/NewsDashboard'
import { useTheme } from './hooks/useTheme'
import { clearAdminCredentials, getAdminCredentials, setAdminCredentials, subscribeAdminAuthChange } from './utils/adminAuth'
import { runtimeConfig } from './utils/runtime'

type AppView = 'news' | 'admin'

function getViewFromHash(hash: string): AppView {
  return hash === '#/admin' ? 'admin' : 'news'
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))
  const [adminUsername, setAdminUsername] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState<string | null>(null)
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => Boolean(getAdminCredentials()))

  useEffect(() => {
    const handleHashChange = () => setView(getViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => subscribeAdminAuthChange(() => setIsAdminAuthenticated(Boolean(getAdminCredentials()))), [])

  useEffect(() => {
    if (runtimeConfig.isStaticDeploy && view === 'admin') {
      window.location.hash = '#/'
      setView('news')
    }
  }, [view])

  function navigate(nextView: AppView) {
    if (runtimeConfig.isStaticDeploy && nextView === 'admin') return
    window.location.hash = nextView === 'admin' ? '#/admin' : '#/'
    setView(nextView)
  }

  function handleAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!adminUsername.trim() || !adminPassword) {
      setAdminError('请输入后台账号和密码')
      return
    }

    setAdminCredentials({
      username: adminUsername.trim(),
      password: adminPassword,
    })
    setAdminError(null)
    setIsAdminAuthenticated(true)
  }

  function handleAdminLogout() {
    clearAdminCredentials()
    setIsAdminAuthenticated(false)
    setAdminPassword('')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.05),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-3 sm:items-center sm:px-6 sm:py-4 lg:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400 sm:text-xs">AI Signal Board</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">新闻聚合</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              className={`btn inline-flex items-center gap-2 ${view === 'news' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => navigate('news')}
              title="前台"
            >
              <Newspaper size={16} />
              <span className="hidden sm:inline">前台</span>
            </button>
            <button className="btn btn-ghost px-3 sm:px-4" onClick={toggleTheme} title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}>
              <span className="sm:hidden">{theme === 'dark' ? '浅' : '深'}</span>
              <span className="hidden sm:inline">{theme === 'dark' ? '浅色' : '深色'}</span>
            </button>
          </div>
        </div>
      </div>

      {view === 'news' || runtimeConfig.isStaticDeploy ? (
        <NewsDashboard theme={theme} toggleTheme={toggleTheme} />
      ) : !isAdminAuthenticated ? (
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center px-4 py-12 sm:px-6">
          <div className="card w-full p-6 sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-center text-2xl font-semibold text-slate-900">后台访问认证</h2>
            <p className="mt-2 text-center text-sm text-slate-500">
              后台入口已隐藏。请通过域名手动访问 `#/admin` 并输入账号密码。
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleAdminLogin}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">账号</label>
                <input
                  className="input"
                  autoComplete="username"
                  value={adminUsername}
                  onChange={(event) => setAdminUsername(event.target.value)}
                  placeholder="请输入后台账号"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">密码</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="请输入后台密码"
                />
              </div>
              {adminError ? <p className="text-sm text-rose-600">{adminError}</p> : null}
              <button className="btn btn-primary w-full" type="submit">
                登录后台
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div>
          <div className="mx-auto flex max-w-7xl justify-end px-4 pt-4 sm:px-6 lg:px-8">
            <button className="btn btn-ghost inline-flex items-center gap-2" onClick={handleAdminLogout}>
              <LogOut className="h-4 w-4" />
              退出后台
            </button>
          </div>
          <AdminDashboard />
        </div>
      )}
    </div>
  )
}
