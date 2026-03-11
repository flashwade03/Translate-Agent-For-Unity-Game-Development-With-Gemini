import { Button } from './ui/Button'

interface ApplyBarProps {
  pendingCount: number
  onApply: () => void
  onDiscard: () => void
  isApplying: boolean
  applyError?: string
}

export function ApplyBar({ pendingCount, onApply, onDiscard, isApplying, applyError }: ApplyBarProps) {
  if (pendingCount === 0) return null

  return (
    <div className="sticky bottom-0 border-t border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between rounded-b-[var(--radius-md)]">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-amber-800">
          {pendingCount} cell{pendingCount !== 1 ? 's' : ''} modified
        </span>
        <span className="text-sm text-amber-600">
          Not yet saved to Google Sheets
        </span>
      </div>
      {applyError && (
        <span className="text-sm text-red-600 mx-4 truncate max-w-xs" title={applyError}>
          {applyError}
        </span>
      )}
      <div className="flex gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={isApplying}>
          Discard
        </Button>
        <Button size="sm" onClick={onApply} disabled={isApplying}>
          {isApplying ? 'Applying...' : 'Apply to Google Sheets'}
        </Button>
      </div>
    </div>
  )
}
