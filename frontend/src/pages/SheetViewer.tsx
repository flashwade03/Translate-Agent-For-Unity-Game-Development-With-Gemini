import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSheetData } from '../hooks/useSheets'
import { useTranslation } from '../hooks/useTranslation'
import { updateSheetRows } from '../api/sheets'
import { PageHeader } from '../components/layout/PageHeader'
import { DataTable } from '../components/DataTable'
import { JobStatusBanner } from '../components/JobStatusBanner'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function SheetViewer() {
  const { projectId, sheetName } = useParams<{ projectId: string; sheetName: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error } = useSheetData(projectId!, sheetName!)
  const { job, isRunning, trigger, dismiss } = useTranslation(projectId!, sheetName!)

  const saveMutation = useMutation({
    mutationFn: (updates: { key: string; langCode: string; value: string }[]) =>
      updateSheetRows(projectId!, sheetName!, updates),
  })

  const handleCellSave = (key: string, langCode: string, value: string) => {
    saveMutation.mutate([{ key, langCode, value }])
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (error || !data) {
    return <div className="text-error py-8">Failed to load sheet data.</div>
  }

  return (
    <div>
      <PageHeader
        title={sheetName!}
        description={`${data.rows.length} keys · ${data.languages.length} languages`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(`/projects/${projectId}/sheets/${encodeURIComponent(sheetName!)}/settings`)
              }
            >
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isRunning}
              onClick={() => trigger('review')}
            >
              Review
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={isRunning}
              onClick={() => trigger('update')}
            >
              Update
            </Button>
            <Button
              size="sm"
              disabled={isRunning}
              onClick={() => trigger('translate_all')}
            >
              Translate All
            </Button>
          </div>
        }
      />

      {job && <JobStatusBanner job={job} onDismiss={dismiss} />}

      <DataTable data={data} disabled={isRunning} onCellSave={handleCellSave} />
    </div>
  )
}
