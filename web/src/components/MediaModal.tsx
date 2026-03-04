import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Expand, ExternalLink, Image as ImageIcon, PlayCircle, X } from 'lucide-react'

import type { MediaItem } from '../types'

interface MediaModalProps {
  isOpen: boolean
  onClose: () => void
  mediaItems: MediaItem[]
  title: string
  sourceUrl: string
  initialIndex?: number
}

export function MediaModal({
  isOpen,
  onClose,
  mediaItems,
  title,
  sourceUrl,
  initialIndex = 0,
}: MediaModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoContainerRef = useRef<HTMLDivElement | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [videoHint, setVideoHint] = useState<string | null>(null)
  const getProxiedMediaUrl = (rawUrl: string) => `/api/media?url=${encodeURIComponent(rawUrl)}`

  const enterVideoFullscreen = async () => {
    const container = videoContainerRef.current
    if (!container) return

    try {
      if (document.fullscreenElement !== container) {
        await container.requestFullscreen()
      }
    } catch {
      setVideoHint('浏览器未允许进入全屏，请使用播放器自带全屏按钮。')
    }
  }

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') {
        setCurrentIndex((value) => (value - 1 + mediaItems.length) % mediaItems.length)
      }
      if (event.key === 'ArrowRight') {
        setCurrentIndex((value) => (value + 1) % mediaItems.length)
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, mediaItems.length, onClose])

  useEffect(() => {
    if (!isOpen) return
    const safeIndex = Math.min(Math.max(initialIndex, 0), Math.max(mediaItems.length - 1, 0))
    setCurrentIndex(safeIndex)
  }, [initialIndex, isOpen, mediaItems.length])

  useEffect(() => {
    if (!isOpen) return

    const currentItem = mediaItems[currentIndex]
    if (!currentItem || currentItem.type !== 'video') {
      setVideoLoading(false)
      setVideoError(null)
      setVideoHint(null)
      return
    }

    setVideoLoading(true)
    setVideoError(null)
    setVideoHint(null)
    return
  }, [currentIndex, isOpen, mediaItems])

  useEffect(() => {
    if (!isOpen) return

    const currentItem = mediaItems[currentIndex]
    if (!currentItem || currentItem.type !== 'video') return

    const video = videoRef.current
    if (!video) return

    video.muted = true
    video.load()

    const attemptPlay = async () => {
      try {
        await video.play()
      } catch {
        setVideoHint('视频已加载，但浏览器未允许自动播放，请点击播放按钮继续。')
      }
    }

    void attemptPlay()
  }, [currentIndex, isOpen, mediaItems])

  if (!isOpen) return null
  if (mediaItems.length === 0) return null

  const imageCount = mediaItems.filter((item) => item.type === 'image').length
  const videoCount = mediaItems.filter((item) => item.type === 'video').length
  const currentItem = mediaItems[currentIndex]
  const canNavigate = mediaItems.length > 1
  const statusLabel = currentItem.type === 'image' ? '图片' : '视频'
  const modal = (
    <div className="fixed inset-0 z-[80] bg-black text-white">
      <div className="absolute inset-0 bg-black/96 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute left-4 right-4 top-4 z-10 flex items-start justify-between gap-4 sm:left-6 sm:right-6">
        <div className="min-w-0 rounded-2xl bg-black/55 px-4 py-3 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">Media Viewer</p>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-white sm:text-base">{title}</h3>
          <p className="mt-1 text-xs text-white/65 sm:text-sm">
            {imageCount > 0 ? `${imageCount} 张图片` : ''}
            {imageCount > 0 && videoCount > 0 ? ' · ' : ''}
            {videoCount > 0 ? `${videoCount} 段视频` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canNavigate && (
            <div className="hidden items-center gap-2 rounded-full bg-black/55 px-3 py-2 text-sm text-white/75 backdrop-blur sm:inline-flex">
              <span>{statusLabel}</span>
              <span>
                {currentIndex + 1} / {mediaItems.length}
              </span>
            </div>
          )}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/70 sm:text-sm"
          >
            打开原文
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/55 p-3 text-white/90 backdrop-blur transition-colors hover:bg-black/70"
            aria-label="关闭媒体弹窗"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative z-[1] flex h-full w-full items-center justify-center px-0 pt-20 sm:pt-24">
        {canNavigate && (
          <button
            type="button"
            onClick={() => setCurrentIndex((value) => (value - 1 + mediaItems.length) % mediaItems.length)}
            className="absolute left-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-3 text-white/90 backdrop-blur transition-colors hover:bg-black/70 sm:left-6"
            aria-label="查看上一张媒体"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-full w-full flex-col overflow-hidden bg-black/20">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
              <div className="inline-flex items-center gap-2 text-sm font-medium text-white/85">
                {currentItem.type === 'image' ? <ImageIcon className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                {statusLabel}
                <span className="text-white/55">
                  {currentIndex + 1} / {mediaItems.length}
                </span>
              </div>
              <a
                href={currentItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
              >
                查看链接
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="flex flex-1 items-center justify-center bg-black px-2 py-4 sm:px-8 sm:py-8">
              {currentItem.type === 'image' ? (
                <img
                  src={currentItem.url}
                  alt={title}
                  className="mx-auto max-h-full w-auto max-w-full object-contain"
                />
              ) : (
                <div
                  ref={videoContainerRef}
                  className="relative flex h-full w-full items-center justify-center"
                >
                  {videoLoading && (
                    <div className="text-sm text-white/70">视频加载中...</div>
                  )}
                  {!videoLoading && videoError && (
                    <div className="flex max-w-lg flex-col items-center gap-3 text-center">
                      <p className="text-sm text-rose-300">{videoError}</p>
                      <a
                        href={getProxiedMediaUrl(currentItem.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/15"
                      >
                        在新窗口打开视频
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                  {!videoLoading && !videoError && (
                    <button
                      type="button"
                      onClick={() => void enterVideoFullscreen()}
                      className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur transition-colors hover:bg-black/75"
                    >
                      全屏播放
                      <Expand className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <video
                    ref={videoRef}
                    key={currentItem.url}
                    controls
                    autoPlay
                    muted
                    playsInline
                    preload="auto"
                    poster={currentItem.posterUrl || undefined}
                    className={`${
                      videoError
                        ? 'hidden'
                        : 'mx-auto aspect-video max-h-[min(56vh,40rem)] w-auto max-w-[min(100%,72rem)] rounded-xl bg-black object-contain shadow-2xl'
                    }`}
                    src={getProxiedMediaUrl(currentItem.url)}
                    onLoadedMetadata={() => setVideoLoading(false)}
                    onCanPlay={() => setVideoLoading(false)}
                    onError={() => {
                      setVideoLoading(false)
                      setVideoError('视频加载失败，代理播放未成功。')
                    }}
                  />
                  {!videoLoading && !videoError && videoHint && (
                    <div className="pointer-events-none absolute bottom-8 left-1/2 max-w-lg -translate-x-1/2 rounded-full bg-black/60 px-4 py-2 text-center text-sm text-white/80 backdrop-blur">
                      {videoHint}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {canNavigate && (
          <button
            type="button"
            onClick={() => setCurrentIndex((value) => (value + 1) % mediaItems.length)}
            className="absolute right-2 top-1/2 z-10 inline-flex -translate-y-1/2 items-center justify-center rounded-full bg-black/55 p-3 text-white/90 backdrop-blur transition-colors hover:bg-black/70 sm:right-6"
            aria-label="查看下一张媒体"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {canNavigate && (
          <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 gap-2 overflow-x-auto rounded-full bg-black/55 px-3 py-2 backdrop-blur">
            {mediaItems.map((item, index) => (
              <button
                key={`${item.type}:${item.url}:${index}:dot`}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  index === currentIndex ? 'bg-white' : 'bg-white/35 hover:bg-white/60'
                }`}
                aria-label={`切换到第 ${index + 1} 个媒体`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
