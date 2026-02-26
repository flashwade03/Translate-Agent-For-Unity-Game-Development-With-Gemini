import { useState, useEffect, useRef } from 'react'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

type Tab = 'empty' | 'csv'

interface AddSheetDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string) => void
  onImport: (name: string, file: File) => void
  isPending: boolean
}

export function AddSheetDialog({ open, onClose, onAdd, onImport, isPending }: AddSheetDialogProps) {
  const [tab, setTab] = useState<Tab>('empty')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTab('empty')
      setName('')
      setFile(null)
    }
  }, [open])

  const handleFileSelect = (f: File) => {
    setFile(f)
    if (!name.trim()) {
      const baseName = f.name.replace(/\.csv$/i, '')
      setName(baseName)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (tab === 'csv') {
      if (!file) return
      onImport(trimmed, file)
    } else {
      onAdd(trimmed)
    }
  }

  const handleClose = () => {
    setName('')
    setFile(null)
    onClose()
  }

  const canSubmit = tab === 'empty'
    ? name.trim().length > 0
    : name.trim().length > 0 && file !== null

  return (
    <Modal open={open} onClose={handleClose} title="Add Sheet">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Create a new empty sheet or import from a CSV file.
        </p>

        {/* Tab bar */}
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-bg-muted p-1">
          <button
            type="button"
            className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'empty'
                ? 'bg-bg-base border border-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setTab('empty')}
          >
            Empty Sheet
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'csv'
                ? 'bg-bg-base border border-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setTab('csv')}
          >
            Import CSV
          </button>
        </div>

        {tab === 'csv' && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const f = e.dataTransfer.files[0]
              if (f && f.name.endsWith('.csv')) handleFileSelect(f)
            }}
            className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-border py-8 text-text-muted hover:border-accent/50 hover:bg-bg-muted/50 transition-colors cursor-pointer"
          >
            <svg className="w-7 h-7 text-text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            {file ? (
              <span className="text-sm font-medium text-text-primary">{file.name}</span>
            ) : (
              <>
                <span className="text-sm">Click to select a CSV file</span>
                <span className="text-xs text-text-muted/60">or drag and drop here</span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFileSelect(f)
            e.target.value = ''
          }}
        />

        <Input
          label={tab === 'csv' ? 'Sheet Name (auto-filled from filename)' : 'Sheet Name'}
          placeholder="e.g. Dialogues, UI_Menu..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={tab === 'empty'}
        />

        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || isPending}>
            {isPending
              ? (tab === 'csv' ? 'Importing...' : 'Creating...')
              : (tab === 'csv' ? 'Import' : 'Create Sheet')
            }
          </Button>
        </div>
      </form>
    </Modal>
  )
}
