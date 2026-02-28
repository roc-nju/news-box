import { useEffect, useState } from 'react'
import { LayoutDashboard, Newspaper } from 'lucide-react'

import { AdminDashboard } from './components/AdminDashboard'
import { NewsDashboard } from './components/NewsDashboard'
import { useTheme } from './hooks/useTheme'
import { runtimeConfig } from './utils/runtime'

type AppView = 'news' | 'admin'

function getViewFromHash(hash: string): AppView {
  return hash === '#/admin' ? 'admin' : 'news'
}

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<AppView>(() => getViewFromHash(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => setView(getViewFromHash(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

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

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.05),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-3 px-4 py-3 sm:items-center sm:px-6 sm:py-4 lg:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400 sm:text-xs">AI Signal Board</p>
            <h1 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
              <span className="sm:hidden">新闻聚合</span>
              <span className="hidden sm:inline">新闻聚合与订阅源后台</span>
            </h1>
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
            <button
              className={`btn inline-flex items-center gap-2 ${view === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => navigate('admin')}
              disabled={runtimeConfig.isStaticDeploy}
              title={runtimeConfig.isStaticDeploy ? 'GitHub Pages 仅提供公开资讯页，后台需本地启动 Node 服务' : undefined}
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm:inline">后台</span>
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
      ) : (
        <AdminDashboard />
      )}
    </div>
  )
}
