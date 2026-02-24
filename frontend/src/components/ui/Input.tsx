import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full px-3 py-2 text-sm border border-border rounded-[var(--radius-sm)]',
            'outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
            'placeholder:text-text-muted',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

Input.displayName = 'Input'
