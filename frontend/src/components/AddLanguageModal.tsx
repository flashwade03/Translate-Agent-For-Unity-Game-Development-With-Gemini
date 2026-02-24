import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

interface AddLanguageModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (code: string, label: string, translateNow: boolean) => void
}

export function AddLanguageModal({ open, onClose, onConfirm }: AddLanguageModalProps) {
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')
  const [translateNow, setTranslateNow] = useState(false)

  const handleSubmit = () => {
    if (!code.trim() || !label.trim()) return
    onConfirm(code.trim().toLowerCase(), label.trim(), translateNow)
    setCode('')
    setLabel('')
    setTranslateNow(false)
  }

  const handleClose = () => {
    setCode('')
    setLabel('')
    setTranslateNow(false)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Language">
      <div className="flex flex-col gap-4">
        <Input
          label="Language Code"
          placeholder="e.g., fr"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Input
          label="Language Label"
          placeholder="e.g., French"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
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
          <Button size="sm" onClick={handleSubmit} disabled={!code.trim() || !label.trim()}>
            Add Language
          </Button>
        </div>
      </div>
    </Modal>
  )
}
