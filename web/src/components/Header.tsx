import { Sun, Moon, Bot, Clock, Info, Github } from 'lucide-react'
import { formatDateTime } from '../utils/formatDate'
import type { TimeRange } from '../hooks/useNewsData'
import { runtimeConfig } from '../utils/runtime'

interface HeaderProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  onRefresh: () => void
  loading?: boolean
  generatedAt?: string | null
  windowHours?: number
  onShowSources?: () => void
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}

export function Header({ 
  theme, 
  toggleTheme,
  generatedAt, 
  windowHours, 
  onShowSources,
  timeRange,
  onTimeRangeChange 
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-3 sm:py-4">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="min-w-0 flex items-start gap-3">
              <div className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/25">
              <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <button 
                  onClick={onShowSources}
                  className="group inline-flex max-w-full items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                    AI 资讯聚合
                  </h1>
                  <Info className="hidden h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </button>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  实时追踪 AI 领域最新动态
                </p>
              </div>
            </div>
          
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <a
                href={runtimeConfig.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost p-2 rounded-lg"
                title="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <button
                onClick={toggleTheme}
                className="btn btn-ghost p-2 rounded-lg"
                title={theme === 'light' ? '切换深色模式' : '切换浅色模式'}
              >
                {theme === 'light' ? (
                  <Moon className="w-5 h-5" />
                ) : (
                  <Sun className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex w-full items-center rounded-full bg-slate-100 p-0.5 dark:bg-slate-800 sm:w-auto">
              <button
                onClick={() => onTimeRangeChange('24h')}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                  timeRange === '24h'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                近 24 小时
              </button>
              <button
                onClick={() => onTimeRangeChange('7d')}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:flex-none ${
                  timeRange === '7d'
                    ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                近 7 天
              </button>
            </div>

            {generatedAt && (
              <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Clock className="w-3.5 h-3.5" />
                <span>自动更新于 {formatDateTime(generatedAt)}</span>
                {windowHours && (
                  <span className="text-slate-400 dark:text-slate-500">· {windowHours}h</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
