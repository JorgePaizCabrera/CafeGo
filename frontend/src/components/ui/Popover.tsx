import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

export default function Popover({ open, onClose, anchorRef, align = 'start', children }: {
  open: boolean
  onClose: () => void
  anchorRef: RefObject<HTMLElement | null>
  align?: 'start' | 'end'
  children: React.ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number, left: number } | null>(null)

  const place = () => {
    const anchor = anchorRef.current?.getBoundingClientRect()
    const panel = panelRef.current?.getBoundingClientRect()
    if (!anchor) return
    const margin = 8
    const width = panel?.width ?? 0
    const height = panel?.height ?? 0
    let left = align === 'end' ? anchor.right - width : anchor.left
    left = Math.min(Math.max(margin, left), window.innerWidth - width - margin)
    let top = anchor.bottom + 6
    if (height && top + height > window.innerHeight - margin) top = Math.max(margin, anchor.top - height - 6)
    setPos({ top, left })
  }

  useLayoutEffect(() => {
    if (open) place()
    else setPos(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(place)
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      className="animate-fade-in fixed z-50 rounded-2xl border border-stone-200 bg-white p-3 shadow-xl shadow-stone-900/10"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {children}
    </div>,
    document.body
  )
}
