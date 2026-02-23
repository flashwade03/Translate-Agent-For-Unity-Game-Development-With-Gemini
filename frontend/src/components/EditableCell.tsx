import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'

interface EditableCellProps {
  value: string
  readOnly?: boolean
  isEmpty?: boolean
  disabled?: boolean
  onSave: (value: string) => void
}

export function EditableCell({ value, readOnly, isEmpty, disabled, onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  if (editing && !readOnly && !disabled) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (draft !== value) onSave(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            setEditing(false)
            if (draft !== value) onSave(draft)
          }
          if (e.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        className="w-full min-h-[2rem] px-2 py-1 text-sm border border-accent rounded-[var(--radius-sm)] outline-none resize-y"
      />
    )
  }

  return (
    <div
      onClick={() => {
        if (!readOnly && !disabled) setEditing(true)
      }}
      className={cn(
        'min-h-[2rem] px-2 py-1 text-sm rounded-[var(--radius-sm)] whitespace-pre-wrap break-words',
        readOnly && 'bg-bg-muted text-text-muted cursor-default',
        !readOnly && !disabled && 'cursor-pointer hover:bg-blue-50',
        isEmpty && !readOnly && 'bg-amber-50',
        disabled && 'opacity-60 cursor-not-allowed',
      )}
    >
      {value || <span className="text-text-muted italic">{readOnly ? '-' : 'Click to edit'}</span>}
    </div>
  )
}
