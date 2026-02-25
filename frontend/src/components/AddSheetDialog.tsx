import { useState, useEffect } from 'react'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

interface AddSheetDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (name: string) => void
  isPending: boolean
}

export function AddSheetDialog({ open, onClose, onAdd, isPending }: AddSheetDialogProps) {
  const [name, setName] = useState('')

  useEffect(() => {
    if (open) setName('')
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd(trimmed)
  }

  const handleClose = () => {
    setName('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Sheet">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Create a new sheet in this project. Language headers will be copied from existing sheets.
        </p>
        <Input
          label="Sheet Name"
          placeholder="e.g. Dialogues, UI_Menu..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || isPending}>
            {isPending ? 'Creating...' : 'Create Sheet'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
