import { cn } from '../lib/utils'
import { Button } from './ui/Button'
import type { TranslationJob } from '../types'

interface JobStatusBannerProps {
  job: TranslationJob
  onDismiss: () => void
}

const typeLabels: Record<string, string> = {
  translate_all: 'Translate All',
  update: 'Update',
  review: 'Review',
}

export function JobStatusBanner({ job, onDismiss }: JobStatusBannerProps) {
  const isDone = job.status === 'completed'
  const isFailed = job.status === 'failed'

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-[var(--radius-md)] mb-4',
        isDone && 'bg-green-50 border border-green-200',
        isFailed && 'bg-red-50 border border-red-200',
        !isDone && !isFailed && 'bg-blue-50 border border-blue-200',
      )}
    >
      <div className="flex-1">
        <div className="text-sm font-medium">
          {typeLabels[job.type] || job.type}
          {' — '}
          <span className="capitalize">{job.status}</span>
        </div>
        {!isDone && !isFailed && (
          <div className="mt-1 w-full bg-blue-100 rounded-full h-1.5">
            <div
              className="bg-accent h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
        <div className="text-xs text-text-muted mt-0.5">
          {job.processedKeys}/{job.totalKeys} keys
        </div>
      </div>

      {(isDone || isFailed) && (
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  )
}
