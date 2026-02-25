import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteLanguageDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  languageLabel: string
  languageCode: string
  translationCount: number
}

export function DeleteLanguageDialog({
  open,
  onClose,
  onConfirm,
  languageLabel,
  languageCode,
  translationCount,
}: DeleteLanguageDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Language" titleIcon="warning">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">
          Are you sure you want to remove {languageLabel} ({languageCode})?
        </p>

        {translationCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-[var(--radius-sm)] p-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-sm text-amber-800">
              {translationCount} existing translation{translationCount !== 1 ? 's' : ''} will be permanently deleted.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete Language
          </Button>
        </div>
      </div>
    </Modal>
  )
}
