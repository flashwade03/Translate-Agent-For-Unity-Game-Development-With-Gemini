import { cn } from '../../lib/utils'

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info'
  children: React.ReactNode
  className?: string
  onClick?: () => void
  active?: boolean
}

const variantStyles = {
  default: 'bg-bg-muted text-text-muted',
  success: 'bg-green-50 text-success',
  warning: 'bg-amber-50 text-warning',
  error: 'bg-red-50 text-error',
  info: 'bg-blue-50 text-accent',
}

export function Badge({ variant = 'default', children, className, onClick, active }: BadgeProps) {
  const Component = onClick ? 'button' : 'span'
  return (
    <Component
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:opacity-80',
        active && 'ring-2 ring-accent',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </Component>
  )
}
