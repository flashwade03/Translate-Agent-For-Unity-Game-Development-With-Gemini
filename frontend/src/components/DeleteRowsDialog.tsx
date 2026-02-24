import { Modal } from './ui/Modal'
import { Button } from './ui/Button'

interface DeleteRowsDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  count: number
}

export function DeleteRowsDialog({
  open,
  onClose,
  onConfirm,
  count,
}: DeleteRowsDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title="Delete Rows">
      <div className="flex flex-col gap-4">
        <div className="bg-red-50 border border-red-200 rounded-[var(--radius-sm)] p-3">
          <p className="text-sm text-red-800">
            <span className="font-semibold">{count} rows</span> and all their translations will be
            permanently deleted. This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            Delete Rows
          </Button>
        </div>
      </div>
    </Modal>
  )
}
