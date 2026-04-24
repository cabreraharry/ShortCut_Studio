import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Tip } from '@/components/ui/cursor-tooltip'

export interface IconButtonProps extends ButtonProps {
  tip: React.ReactNode
  /**
   * @deprecated CursorTooltip positions near the cursor, ignoring side.
   * Kept for call-site compatibility; has no effect.
   */
  tipSide?: 'top' | 'bottom' | 'left' | 'right'
  ariaLabel?: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tip, tipSide: _tipSide, ariaLabel, children, size = 'icon', variant = 'ghost', ...rest }, ref) => {
    const label = ariaLabel ?? (typeof tip === 'string' ? tip : undefined)
    return (
      <Tip content={tip}>
        <Button ref={ref} size={size} variant={variant} aria-label={label} {...rest}>
          {children}
        </Button>
      </Tip>
    )
  }
)
IconButton.displayName = 'IconButton'
