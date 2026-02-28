import { Search, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { SiteStat } from '../types'
import type { SourceStat } from '../hooks/useNewsData'
import { SiteFilters } from './SiteFilters'

interface FilterBarProps {
  siteStats: SiteStat[]
  sourceStats: SourceStat[]
  selectedSite: string
  onSiteChange: (site: string) => void
  selectedSource: string
  onSourceChange: (source: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

export function FilterBar({
  siteStats,
  sourceStats,
  selectedSite,
  onSiteChange,
  selectedSource,
  onSourceChange,
  searchQuery,
  onSearchChange,
}: FilterBarProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const summary = useMemo(() => {
    const siteLabel = selectedSite === 'all'
      ? '全部站点'
      : siteStats.find((site) => site.site_id === selectedSite)?.site_name || '当前站点'
    const sourceLabel = selectedSource === 'all' ? '全部来源' : selectedSource

    return `${siteLabel} · ${sourceLabel}`
  }, [selectedSite, selectedSource, siteStats])

  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="搜索资讯标题、来源..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="input pl-10"
          />
        </div>

        <button
          onClick={() => setMobileExpanded((value) => !value)}
          className="btn btn-ghost flex items-center justify-between gap-2 border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 sm:hidden"
        >
          <span className="flex min-w-0 items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 shrink-0" />
            <span className="truncate">{summary}</span>
          </span>
          {mobileExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
        </button>
      </div>

      <div className={mobileExpanded ? 'block sm:block' : 'hidden sm:block'}>
        <SiteFilters
          siteStats={siteStats}
          sourceStats={sourceStats}
          selectedSite={selectedSite}
          onSiteChange={onSiteChange}
          selectedSource={selectedSource}
          onSourceChange={onSourceChange}
        />
      </div>
    </div>
  )
}
