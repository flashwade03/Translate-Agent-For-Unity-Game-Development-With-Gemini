import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteSheetDialogProps {
  open: boolean
  sheetName: string
  keyCount: number
  onClose: () => void
  onDelete: () => void
  isPending: boolean
}

export function DeleteSheetDialog({
  open,
  sheetName,
  keyCount,
  onClose,
  onDelete,
  isPending,
}: DeleteSheetDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Sheet">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text">
          Are you sure you want to delete &apos;{sheetName}&apos;?
        </p>
        {keyCount > 0 && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-medium rounded-[var(--radius-sm)] px-4 py-3">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {keyCount} translation key{keyCount !== 1 ? 's' : ''} will be permanently deleted.
          </div>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            disabled={isPending}
            className="!bg-red-600 hover:!bg-red-700 !border-red-600"
          >
            {isPending ? 'Deleting...' : 'Delete Sheet'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
