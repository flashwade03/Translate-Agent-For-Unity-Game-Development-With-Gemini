import { cn } from '../../lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-border border-t-accent',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-6 w-6',
        className,
      )}
    />
  )
}
