import { useEffect, useState } from 'react'
import { LayoutDashboard, Newspaper } from 'lucide-react'

import { AdminDashboard } from './components/AdminDashboard'
import { NewsDashboard } from './components/NewsDashboard'
import { useTheme } from './hooks/useTheme'

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

  function navigate(nextView: AppView) {
    window.location.hash = nextView === 'admin' ? '#/admin' : '#/'
    setView(nextView)
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.05),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
      <div className="border-b border-white/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">AI Signal Board</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">新闻聚合与订阅源后台</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`btn inline-flex items-center gap-2 ${view === 'news' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => navigate('news')}
            >
              <Newspaper size={16} />
              前台
            </button>
            <button
              className={`btn inline-flex items-center gap-2 ${view === 'admin' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => navigate('admin')}
            >
              <LayoutDashboard size={16} />
              后台
            </button>
            <button className="btn btn-ghost" onClick={toggleTheme}>
              {theme === 'dark' ? '浅色' : '深色'}
            </button>
          </div>
        </div>
      </div>

      {view === 'news' ? <NewsDashboard theme={theme} toggleTheme={toggleTheme} /> : <AdminDashboard />}
    </div>
  )
}
