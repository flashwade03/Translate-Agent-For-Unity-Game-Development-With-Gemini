import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteProjectLanguageDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  languageLabel: string
  isPending: boolean
}

export function DeleteProjectLanguageDialog({
  open,
  onClose,
  onConfirm,
  languageLabel,
  isPending,
}: DeleteProjectLanguageDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${languageLabel}?`} titleIcon="warning">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          This will permanently remove the <strong>{languageLabel}</strong> column
          from all sheets in this project. This action cannot be undone.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-3 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-amber-800">
            All existing translations for this language will be permanently deleted.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Deleting...' : 'Delete Language'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
