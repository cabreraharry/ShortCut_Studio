import * as React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface IconButtonProps extends ButtonProps {
  tip: React.ReactNode
  tipSide?: 'top' | 'bottom' | 'left' | 'right'
  ariaLabel?: string
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tip, tipSide = 'top', ariaLabel, children, size = 'icon', variant = 'ghost', ...rest }, ref) => {
    const label = ariaLabel ?? (typeof tip === 'string' ? tip : undefined)
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} size={size} variant={variant} aria-label={label} {...rest}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tipSide}>{tip}</TooltipContent>
      </Tooltip>
    )
  }
)
IconButton.displayName = 'IconButton'
