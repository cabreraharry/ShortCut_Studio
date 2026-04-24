import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * Cursor-anchored tooltip. Shows the tooltip near the cursor position at the
 * moment the pointer enters the trigger, and keeps it there until pointer
 * leaves. Keyboard focus is not supported (mouse-only UX) — if a future screen
 * reader pass is needed, add aria-describedby manually at the call site.
 *
 * Usage:
 *   <Tip content="Jump to Dashboard">
 *     <button>...</button>
 *   </Tip>
 */

const DEFAULT_DELAY_MS = 400
const OFFSET_X = 10
const OFFSET_Y = 16

interface TipProps {
  content: React.ReactNode
  children: React.ReactElement
  delayDuration?: number
}

export function Tip({
  content,
  children,
  delayDuration = DEFAULT_DELAY_MS
}: TipProps): JSX.Element {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const [visible, setVisible] = React.useState(false)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const child = React.Children.only(children)
  const childProps = child.props as {
    onPointerEnter?: (e: React.PointerEvent) => void
    onPointerLeave?: (e: React.PointerEvent) => void
    onClick?: (e: React.MouseEvent) => void
  }

  function clearTimer(): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  function handleEnter(e: React.PointerEvent): void {
    childProps.onPointerEnter?.(e)
    const x = e.clientX
    const y = e.clientY
    clearTimer()
    timerRef.current = setTimeout(() => {
      setPos({ x, y })
      setVisible(true)
    }, delayDuration)
  }

  function handleLeave(e: React.PointerEvent): void {
    childProps.onPointerLeave?.(e)
    clearTimer()
    setVisible(false)
  }

  function handleClick(e: React.MouseEvent): void {
    childProps.onClick?.(e)
    // Clicking the trigger should dismiss the tooltip; many users treat click
    // as "I've seen it, thanks."
    clearTimer()
    setVisible(false)
  }

  React.useEffect(() => () => clearTimer(), [])

  const wrappedChild = React.cloneElement(child, {
    onPointerEnter: handleEnter,
    onPointerLeave: handleLeave,
    onClick: handleClick
  })

  return (
    <>
      {wrappedChild}
      {visible && pos && <TipPortal pos={pos}>{content}</TipPortal>}
    </>
  )
}

interface TipPortalProps {
  pos: { x: number; y: number }
  children: React.ReactNode
}

function TipPortal({ pos, children }: TipPortalProps): JSX.Element {
  // Clamp to viewport so the tooltip doesn't overflow the right/bottom edges.
  const [left, setLeft] = React.useState(pos.x + OFFSET_X)
  const [top, setTop] = React.useState(pos.y + OFFSET_Y)
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useLayoutEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const maxLeft = window.innerWidth - rect.width - 8
    const maxTop = window.innerHeight - rect.height - 8
    setLeft(Math.min(Math.max(8, pos.x + OFFSET_X), maxLeft))
    setTop(Math.min(Math.max(8, pos.y + OFFSET_Y), maxTop))
  }, [pos.x, pos.y])

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={{ position: 'fixed', left, top, pointerEvents: 'none' }}
      className={cn(
        'z-[60] max-w-xs rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md',
        'animate-in fade-in-0 zoom-in-95 duration-150'
      )}
    >
      {children}
    </div>,
    document.body
  )
}
