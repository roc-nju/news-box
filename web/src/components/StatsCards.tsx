import { FileText, Database, Sparkles } from 'lucide-react'
import type { SiteStat } from '../types'

interface StatsCardsProps {
  totalItems: number
  sourceCount: number
  windowHours: number
  siteStats: SiteStat[]
  onShowSources: () => void
}

export function StatsCards({ totalItems, sourceCount, windowHours, siteStats, onShowSources }: StatsCardsProps) {
  const totalRawItems = siteStats.reduce((sum, s) => sum + s.raw_count, 0)
  
  return (
    <div className="card p-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3 sm:hidden">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">近 {windowHours} 小时</p>
          <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
            {totalItems.toLocaleString()} 条资讯 · {sourceCount} 个订阅源
          </p>
        </div>
        <button
          onClick={onShowSources}
          className="shrink-0 rounded-full bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-300"
        >
          来源详情
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">近 {windowHours} 小时</span>
            <span className="mx-1.5 font-semibold text-slate-900 dark:text-white">{totalItems.toLocaleString()}</span>
            <span className="text-slate-500 dark:text-slate-400">条资讯</span>
          </div>
        </div>

        <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700" />

        <button 
          onClick={onShowSources}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity text-left"
        >
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">来自</span>
            <span className="mx-1.5 font-semibold text-slate-900 dark:text-white">{siteStats.length}</span>
            <span className="text-slate-500 dark:text-slate-400">个平台</span>
            <span className="mx-1.5 font-semibold text-slate-900 dark:text-white">{sourceCount}</span>
            <span className="text-slate-500 dark:text-slate-400">个订阅源</span>
            <span className="ml-1 text-primary-500 text-xs">查看详情 →</span>
          </div>
        </button>

        <div className="hidden sm:block w-px h-4 bg-slate-200 dark:bg-slate-700" />

        <div className="hidden sm:flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <Sparkles className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-sm">
            <span className="text-slate-500 dark:text-slate-400">从</span>
            <span className="mx-1.5 font-semibold text-slate-900 dark:text-white">{totalRawItems.toLocaleString()}</span>
            <span className="text-slate-500 dark:text-slate-400">条中智能筛选</span>
          </div>
        </div>
      </div>
    </div>
  )
}
