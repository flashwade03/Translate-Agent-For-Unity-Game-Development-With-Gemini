import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchReviewReport } from '../api/config'
import { QUERY_KEYS } from '../lib/constants'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { useSheetNames } from '../hooks/useSheets'
import type { IssueCategory, IssueSeverity, ReviewStats } from '../types'

const severityVariant: Record<IssueSeverity, 'error' | 'warning' | 'info'> = {
  error: 'error',
  warning: 'warning',
  info: 'info',
}

const categoryLabels: Record<IssueCategory, string> = {
  accuracy: 'Accuracy',
  fluency: 'Fluency',
  terminology: 'Terminology',
  style: 'Style',
  placeholder: 'Placeholder',
  length: 'Length',
}

export default function ReviewReport() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: sheets } = useSheetNames(projectId!)
  const firstSheet = sheets?.[0] || ''

  const [selectedSheet, setSelectedSheet] = useState('')
  const sheetName = selectedSheet || firstSheet

  const { data: report, isLoading } = useQuery({
    queryKey: QUERY_KEYS.review(projectId!, sheetName),
    queryFn: () => fetchReviewReport(projectId!, sheetName),
    enabled: !!projectId && !!sheetName,
  })

  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | null>(null)

  const stats: ReviewStats = useMemo(() => {
    if (!report) return { total: 0, errors: 0, warnings: 0, info: 0 }
    return {
      total: report.issues.length,
      errors: report.issues.filter((i) => i.severity === 'error').length,
      warnings: report.issues.filter((i) => i.severity === 'warning').length,
      info: report.issues.filter((i) => i.severity === 'info').length,
    }
  }, [report])

  const filteredIssues = useMemo(() => {
    if (!report) return []
    return report.issues.filter((issue) => {
      if (severityFilter && issue.severity !== severityFilter) return false
      if (categoryFilter && issue.category !== categoryFilter) return false
      return true
    })
  }, [report, severityFilter, categoryFilter])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Review Report" />

      {/* Sheet selector */}
      {sheets && sheets.length > 1 && (
        <div className="flex gap-2 mb-4">
          {sheets.map((s) => (
            <Badge
              key={s}
              variant={s === sheetName ? 'info' : 'default'}
              active={s === sheetName}
              onClick={() => setSelectedSheet(s)}
            >
              {s}
            </Badge>
          ))}
        </div>
      )}

      {!report ? (
        <div className="text-text-muted py-8 text-center">
          No review report available for this sheet. Run a Review from the Sheet Viewer.
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <Card>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-text-muted">Total Issues</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-error">{stats.errors}</div>
              <div className="text-xs text-text-muted">Errors</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-warning">{stats.warnings}</div>
              <div className="text-xs text-text-muted">Warnings</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-accent">{stats.info}</div>
              <div className="text-xs text-text-muted">Info</div>
            </Card>
          </div>

          {/* Filter badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-xs text-text-muted self-center mr-1">Severity:</span>
            {(['error', 'warning', 'info'] as IssueSeverity[]).map((s) => (
              <Badge
                key={s}
                variant={severityVariant[s]}
                active={severityFilter === s}
                onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
              >
                {s}
              </Badge>
            ))}

            <span className="text-xs text-text-muted self-center ml-3 mr-1">Category:</span>
            {(Object.keys(categoryLabels) as IssueCategory[]).map((c) => (
              <Badge
                key={c}
                variant="default"
                active={categoryFilter === c}
                onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
              >
                {categoryLabels[c]}
              </Badge>
            ))}
          </div>

          {/* Issue cards */}
          <div className="flex flex-col gap-3">
            {filteredIssues.map((issue) => (
              <Card key={issue.id}>
                <div className="flex items-start gap-3">
                  <Badge variant={severityVariant[issue.severity]}>
                    {issue.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-text-muted">{issue.key}</span>
                      <Badge variant="default">{issue.language}</Badge>
                      <Badge variant="default">{categoryLabels[issue.category]}</Badge>
                    </div>
                    <p className="text-sm mb-2">{issue.message}</p>
                    <div className="text-xs text-text-muted space-y-0.5">
                      <div>
                        <span className="font-medium">Original:</span> {issue.original}
                      </div>
                      <div>
                        <span className="font-medium">Translated:</span>{' '}
                        {issue.translated || <span className="italic">(empty)</span>}
                      </div>
                      {issue.suggestion && (
                        <div className="text-accent">
                          <span className="font-medium">Suggestion:</span> {issue.suggestion}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
            {filteredIssues.length === 0 && (
              <div className="text-center py-8 text-text-muted">
                No issues match the current filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
