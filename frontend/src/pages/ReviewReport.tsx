import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchReviewReport } from '../api/config'
import { QUERY_KEYS } from '../lib/constants'
import { PageHeader } from '../components/layout/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { useSheetNames } from '../hooks/useSheets'
import { useTranslation } from '../hooks/useTranslation'
import type { IssueCategory, IssueSeverity } from '../types'

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

  const { trigger, isRunning } = useTranslation(projectId!, sheetName)

  const [activeFilter, setActiveFilter] = useState<string | null>(null)

  const stats = useMemo(() => {
    if (!report) return { totalKeys: 0, issuesFound: 0, passed: 0 }
    const issuesFound = report.issues.length
    const totalKeys = issuesFound + (report.totalKeys ?? issuesFound)
    return {
      totalKeys: report.totalKeys ?? totalKeys,
      issuesFound,
      passed: (report.totalKeys ?? totalKeys) - issuesFound,
    }
  }, [report])

  const filteredIssues = useMemo(() => {
    if (!report) return []
    if (!activeFilter) return report.issues
    return report.issues.filter(
      (issue) => issue.category === activeFilter || issue.severity === activeFilter,
    )
  }, [report, activeFilter])

  // Collect unique categories from issues for filter tabs
  const filterTabs = useMemo(() => {
    if (!report) return []
    const cats = new Set(report.issues.map((i) => i.category))
    return Array.from(cats)
  }, [report])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Review Report${sheetName ? ` — ${sheetName}` : ''}`}
        description={report?.lastReviewedAt ? `Last reviewed: ${new Date(report.lastReviewedAt).toLocaleString()}` : undefined}
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={isRunning || !sheetName}
            onClick={() => trigger('review')}
          >
            Re-run Review
          </Button>
        }
      />

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
          {/* Stat cards — 3 cards matching Pencil */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Card>
              <div className="text-2xl font-bold">{stats.totalKeys}</div>
              <div className="text-xs text-text-muted">Total Keys</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-error">{stats.issuesFound}</div>
              <div className="text-xs text-text-muted">Issues Found</div>
            </Card>
            <Card>
              <div className="text-2xl font-bold text-success">{stats.passed}</div>
              <div className="text-xs text-text-muted">Passed</div>
            </Card>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            <Badge
              variant="default"
              active={activeFilter === null}
              onClick={() => setActiveFilter(null)}
            >
              All
            </Badge>
            {filterTabs.map((cat) => (
              <Badge
                key={cat}
                variant="default"
                active={activeFilter === cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
              >
                {categoryLabels[cat as IssueCategory] ?? cat}
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
