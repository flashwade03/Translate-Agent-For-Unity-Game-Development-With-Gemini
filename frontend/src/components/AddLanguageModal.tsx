import { useState } from 'react'
import { useProjectLanguages } from '../hooks/useProjectLanguages'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface AddLanguageModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (code: string, label: string, translateNow: boolean) => void
  projectId: string
  existingCodes: string[]
}

export function AddLanguageModal({ open, onClose, onConfirm, projectId, existingCodes }: AddLanguageModalProps) {
  const { data: projectLangs } = useProjectLanguages(projectId)
  const [selected, setSelected] = useState('')
  const [translateNow, setTranslateNow] = useState(false)

  const availableLangs = (projectLangs ?? []).filter((l) => !existingCodes.includes(l.code))

  const handleSubmit = () => {
    const lang = availableLangs.find((l) => l.code === selected)
    if (!lang) return
    onConfirm(lang.code, lang.label, translateNow)
    setSelected('')
    setTranslateNow(false)
  }

  const handleClose = () => {
    setSelected('')
    setTranslateNow(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Language">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">Add a new translation language to this sheet.</p>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Language</label>
          <div className="relative">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-[var(--radius-sm)] text-sm bg-white appearance-none pr-8 outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Select a language...</option>
              {availableLangs.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label} ({lang.code})
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          {availableLangs.length === 0 && (
            <p className="text-xs text-text-muted">
              All project languages are already added to this sheet.
            </p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={translateNow}
            onChange={(e) => setTranslateNow(e.target.checked)}
            className="rounded border-border text-accent focus:ring-accent"
          />
          Translate now after adding
        </label>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!selected}>
            Add Language
          </Button>
        </div>
      </div>
    </Modal>
  )
}
