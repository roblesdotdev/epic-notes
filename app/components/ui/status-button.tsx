import * as React from 'react'
import { useSpinDelay } from 'spin-delay'
import { cn } from '~/utils/misc.tsx'
import { Button, type ButtonProps } from './button.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip.tsx'
import UpdateIcon from './icons/update-icon.tsx'
import CheckIcon from './icons/check-icon.tsx'
import XMarkIcon from './icons/x-mark-icon.tsx'

export const StatusButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & {
    status: 'pending' | 'success' | 'error' | 'idle'
    message?: string | null
    spinDelay?: Parameters<typeof useSpinDelay>[1]
  }
>(({ message, status, className, children, spinDelay, ...props }, ref) => {
  const delayedPending = useSpinDelay(status === 'pending', {
    delay: 400,
    minDuration: 300,
    ...spinDelay,
  })
  const companion = {
    pending: delayedPending ? (
      <div className="inline-flex h-6 w-6 items-center justify-center">
        <UpdateIcon className="h-4 w-4 animate-spin" />
      </div>
    ) : null,
    success: (
      <div className="inline-flex h-6 w-6 items-center justify-center">
        <CheckIcon className="h-4 w-4" />
      </div>
    ),
    error: (
      <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-destructive">
        <XMarkIcon className="h-4 w-4" />
      </div>
    ),
    idle: null,
  }[status]

  return (
    <Button
      ref={ref}
      className={cn('flex justify-center gap-4', className)}
      {...props}
    >
      <div>{children}</div>
      {message ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>{companion}</TooltipTrigger>
            <TooltipContent>{message}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        companion
      )}
    </Button>
  )
})
StatusButton.displayName = 'Button'
