import { ChevronDown, ChevronUp, ExternalLink, Clock, Image as ImageIcon, PlayCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { NewsItem } from '../types'
import { SourceBadge } from './SourceBadge'
import { formatDateTime } from '../utils/formatDate'
import { MediaModal } from './MediaModal'

interface NewsCardProps {
  item: NewsItem
  index: number
}

function normalizeMultilineText(text: string | null | undefined): string {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function getDisplayTitle(item: NewsItem): string {
  const preferredTitle = item.title_zh || item.title
  if (item.site_id !== 'opmlrss') return preferredTitle

  const firstLine = normalizeMultilineText(preferredTitle)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean)

  return firstLine || preferredTitle
}

function getDisplayContent(item: NewsItem, displayTitle: string): string | null {
  const primary = normalizeMultilineText(item.content_text)
  const fallback = item.site_id === 'opmlrss' ? normalizeMultilineText(item.title) : ''
  let content = primary || fallback

  if (!content) return null

  const title = normalizeMultilineText(displayTitle)
  if (title && content !== title && content.startsWith(`${title}\n`)) {
    content = content.slice(title.length).trim()
  }

  if (!content || content === title) return null
  return content
}

export function NewsCard({ item, index }: NewsCardProps) {
  const displayTitle = useMemo(() => getDisplayTitle(item), [item])
  const displayContent = useMemo(() => getDisplayContent(item, displayTitle), [item, displayTitle])
  const collapsedText = useMemo(() => displayContent?.replace(/\s+/g, ' ').trim() || '', [displayContent])
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [mediaStartIndex, setMediaStartIndex] = useState(0)
  const contentRef = useRef<HTMLParagraphElement | null>(null)
  const mediaItems = item.media_items || []
  const imageCount = mediaItems.filter((media) => media.type === 'image').length
  const videoCount = mediaItems.filter((media) => media.type === 'video').length
  const firstImageIndex = mediaItems.findIndex((media) => media.type === 'image')
  const firstVideoIndex = mediaItems.findIndex((media) => media.type === 'video')

  useEffect(() => {
    if (expanded || !contentRef.current || !collapsedText) return

    const measure = () => {
      const element = contentRef.current
      if (!element) return
      setCanExpand(element.scrollHeight > element.clientHeight + 1)
    }

    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [collapsedText, expanded])

  useEffect(() => {
    setExpanded(false)
  }, [item.id])

  useEffect(() => {
    setShowMediaModal(false)
    setMediaStartIndex(0)
  }, [item.id])

  const shouldToggle = expanded || canExpand

  return (
    <article
      className="card card-hover p-4 block animate-slide-up group"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <SourceBadge siteId={item.site_id} siteName={item.site_name} />
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
              {item.source}
            </span>
          </div>
          
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
            <h3 className="text-base font-medium text-slate-900 dark:text-white leading-relaxed group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
              {displayTitle}
            </h3>
          </a>

          {displayContent && (
            <div className="mt-2">
              <p
                ref={contentRef}
                className={`text-sm leading-6 text-slate-600 dark:text-slate-300 ${
                  expanded ? 'whitespace-pre-line' : 'line-clamp-4 sm:line-clamp-2'
                }`}
              >
                {expanded ? displayContent : collapsedText}
              </p>

              {shouldToggle && (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  {expanded ? (
                    <>
                      收起
                      <ChevronUp className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      展开全文
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(item.published_at || item.first_seen_at)}
            </span>
          </div>

          {mediaItems.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {imageCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaStartIndex(firstImageIndex >= 0 ? firstImageIndex : 0)
                    setShowMediaModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-950/70"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  查看图片
                  <span>{imageCount}</span>
                </button>
              )}
              {videoCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaStartIndex(firstVideoIndex >= 0 ? firstVideoIndex : 0)
                    setShowMediaModal(true)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                >
                  <PlayCircle className="h-3.5 w-3.5" />
                  查看视频
                  <span>{videoCount}</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="打开原文"
        >
          <ExternalLink className="w-5 h-5 text-slate-400" />
        </a>
      </div>

      <MediaModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        mediaItems={mediaItems}
        title={displayTitle}
        sourceUrl={item.url}
        initialIndex={mediaStartIndex}
      />
    </article>
  )
}
