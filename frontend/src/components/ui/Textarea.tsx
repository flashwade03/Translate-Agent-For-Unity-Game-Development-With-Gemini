import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, className, id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-text">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-3 py-2 text-sm border border-border rounded-[var(--radius-sm)]',
            'outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
            'placeholder:text-text-muted resize-y min-h-[80px]',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
