import { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors rounded-[var(--radius-sm)] cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        variant === 'primary' &&
          'bg-accent text-white hover:bg-accent-hover',
        variant === 'outline' &&
          'border border-border bg-white text-text hover:bg-bg-muted',
        variant === 'ghost' &&
          'text-text-muted hover:bg-bg-muted',
        variant === 'danger' &&
          'bg-error text-white hover:bg-red-700',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
