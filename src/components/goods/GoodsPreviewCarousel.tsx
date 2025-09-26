import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GoodsMockupPreview } from '@/components/goods/GoodsMockupPreview'
import type { Geometry } from '@/components/goods/GoodsMockupPreview'

export type PreviewSlide = {
  mockupUrl?: string | null
  variantId?: string
  artOnly?: boolean
  artUrl?: string | null // スライド単位で別アートを使用
  geometry?: Geometry // スライドごとのジオメトリ
}

type Props = {
  slides: PreviewSlide[]
  artUrl?: string | null
  size?: number
  enableSwipe?: boolean
  autoplayMs?: number // 0 or undefined to disable
  pauseOnHover?: boolean
}

export const GoodsPreviewCarousel: React.FC<Props> = ({ slides, artUrl, size = 192, enableSwipe = true, autoplayMs = 0, pauseOnHover = true }) => {
  const validSlides = useMemo(() => {
    const src = slides && slides.length ? slides : [{ mockupUrl: undefined, artOnly: true }]
    return src.slice(0, 10) // 最大10枚
  }, [slides])
  const [index, setIndex] = useState(0)
  const max = validSlides.length
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [paused, setPaused] = useState(false)

  const prev = () => setIndex((i) => (i - 1 + max) % max)
  const next = () => setIndex((i) => (i + 1) % max)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(document.activeElement)) return
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [max])

  // Autoplay
  useEffect(() => {
    if (!autoplayMs || autoplayMs <= 0) return
    if (paused) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % max)
    }, autoplayMs)
    return () => window.clearInterval(id)
  }, [autoplayMs, paused, max])

  // Swipe/touch
  useEffect(() => {
    if (!enableSwipe) return
    const el = containerRef.current
    if (!el) return
    let startX = 0
    let isDown = false

    const onDown = (e: PointerEvent) => {
      isDown = true
      startX = e.clientX
      el.setPointerCapture(e.pointerId)
    }
    const onUp = (e: PointerEvent) => {
      if (!isDown) return
      isDown = false
      const dx = e.clientX - startX
      const threshold = 30
      if (dx > threshold) prev()
      else if (dx < -threshold) next()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [enableSwipe, max])

  function isControlTarget(el: EventTarget | null): boolean {
    if (!(el instanceof Element)) return false
    return !!el.closest('[data-carousel-control="true"]')
  }

  return (
    <div
      className="relative"
      ref={containerRef}
      tabIndex={0}
      aria-roledescription="carousel"
      aria-label="プレビュー画像"
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
      onFocus={pauseOnHover ? () => setPaused(true) : undefined}
      onBlur={pauseOnHover ? () => setPaused(false) : undefined}
    >
      <div
        className="relative overflow-hidden rounded-lg"
        style={{ width: size, height: size }}
        onClick={(e) => { if (!isControlTarget(e.target)) next() }}
        role="button"
        aria-label="次の画像へ"
      >
        {validSlides.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            <GoodsMockupPreview
              mockupUrl={s.mockupUrl}
              artUrl={s.artUrl ?? artUrl ?? undefined}
              variantId={s.variantId}
              size={size}
              artOnly={s.artOnly}
              geometry={s.geometry}
            />
          </div>
        ))}
      </div>

      {max > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow text-gray-800"
            data-carousel-control="true"
            aria-label="前の画像"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/80 hover:bg-white shadow text-gray-800"
            data-carousel-control="true"
            aria-label="次の画像"
          >
            ›
          </button>
          <div className="mt-2 flex items-center justify-center gap-1" role="tablist" aria-label="スライド選択">
            {validSlides.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-gray-800' : 'bg-gray-300'}`}
                data-carousel-control="true"
                aria-label={`スライド ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default GoodsPreviewCarousel
