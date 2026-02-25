import { useParams } from 'react-router-dom'
import { useJobHistory } from '../hooks/useJobHistory'
import { PageHeader } from '../components/layout/PageHeader'
import { Spinner } from '../components/ui/Spinner'
import type { JobHistoryEntry } from '../types'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function formatDuration(start: string, end?: string): string {
  if (!end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const secs = Math.floor(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remSecs = secs % 60
  return `${mins}m ${remSecs}s`
}

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  translate_all: { icon: 'T', label: 'Translate All' },
  update: { icon: 'U', label: 'Update' },
  review: { icon: 'R', label: 'Review' },
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  running: 'bg-blue-50 text-blue-700',
  pending: 'bg-gray-50 text-gray-600',
}

function JobRow({ entry }: { entry: JobHistoryEntry }) {
  const typeConf = TYPE_CONFIG[entry.type] || { icon: '?', label: entry.type }
  const statusStyle = STATUS_STYLES[entry.status] || STATUS_STYLES.pending

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-muted/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-accent/10 text-accent text-xs font-bold">
            {typeConf.icon}
          </span>
          <span className="text-sm">{typeConf.label}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{entry.sheetName}</td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle}`}>
          {entry.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">
        {entry.processedKeys}/{entry.totalKeys}
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">
        {formatRelativeTime(entry.createdAt)}
      </td>
      <td className="px-4 py-3 text-sm text-text-muted">
        {formatDuration(entry.createdAt, entry.completedAt)}
      </td>
    </tr>
  )
}

export default function JobHistory() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: jobs, isLoading, error } = useJobHistory(projectId!)

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return <div className="text-error py-8">Failed to load job history.</div>
  }

  return (
    <div>
      <PageHeader title="Job History" description="View past translation, update, and review jobs." />

      {!jobs || jobs.length === 0 ? (
        <div className="text-center text-text-muted py-16">
          No jobs have been run yet.
        </div>
      ) : (
        <div className="border border-border rounded-[var(--radius-md)] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-bg-muted border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Sheet</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Keys</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Started</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-text-muted uppercase tracking-wide">Duration</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((entry) => (
                <JobRow key={entry.jobId} entry={entry} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
