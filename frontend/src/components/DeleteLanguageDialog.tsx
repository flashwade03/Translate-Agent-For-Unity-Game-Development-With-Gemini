import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteLanguageDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  languageLabel: string
  translationCount: number
}

export function DeleteLanguageDialog({
  open,
  onClose,
  onConfirm,
  languageLabel,
  translationCount,
}: DeleteLanguageDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Language">
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-[var(--radius-sm)] p-3">
          <p className="text-sm text-red-800">
            This will permanently delete{' '}
            <span className="font-semibold">{translationCount} translations</span> for{' '}
            <span className="font-semibold">{languageLabel}</span>. This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}
