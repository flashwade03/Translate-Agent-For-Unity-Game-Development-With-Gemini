import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteProjectLanguageDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  languageLabel: string
  affectedSheets: number
  affectedTranslations: number
  isPending: boolean
}

export function DeleteProjectLanguageDialog({
  open,
  onClose,
  onConfirm,
  languageLabel,
  affectedSheets,
  affectedTranslations,
  isPending,
}: DeleteProjectLanguageDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={`Delete ${languageLabel}?`}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--muted-foreground)]">
          This will permanently remove the <strong>{languageLabel}</strong> column
          from all sheets. This action cannot be undone.
        </p>

        {(affectedSheets > 0 || affectedTranslations > 0) && (
          <div className="bg-red-50 border border-red-200 rounded-[var(--radius-md)] p-3 text-sm">
            <p className="font-medium text-[var(--destructive)]">Impact:</p>
            <ul className="mt-1 text-[var(--destructive)] list-disc list-inside">
              <li>{affectedSheets} sheet{affectedSheets !== 1 ? 's' : ''} affected</li>
              <li>{affectedTranslations} translation{affectedTranslations !== 1 ? 's' : ''} will be deleted</li>
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isPending}
            className="bg-[var(--destructive)] hover:bg-[var(--destructive)]/90 text-white"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
