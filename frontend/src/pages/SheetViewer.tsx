import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSheetData, useAddRow, useDeleteRows } from '../hooks/useSheets'
import { useTranslation } from '../hooks/useTranslation'
import { useLanguages } from '../hooks/useLanguages'
import { updateSheetRows } from '../api/sheets'
import { PageHeader } from '../components/layout/PageHeader'
import { DataTable } from '../components/DataTable'
import { JobStatusBanner } from '../components/JobStatusBanner'
import { AddLanguageModal } from '../components/AddLanguageModal'
import { DeleteLanguageDialog } from '../components/DeleteLanguageDialog'
import { DeleteRowsDialog } from '../components/DeleteRowsDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function SheetViewer() {
  const { projectId, sheetName } = useParams<{ projectId: string; sheetName: string }>()
  const navigate = useNavigate()
  const { data, isLoading, error } = useSheetData(projectId!, sheetName!)
  const { job, isRunning, trigger, dismiss } = useTranslation(projectId!, sheetName!)
  const { addMutation, deleteMutation } = useLanguages(projectId!, sheetName!)
  const addRowMutation = useAddRow(projectId!, sheetName!)
  const deleteRowsMutation = useDeleteRows(projectId!, sheetName!)

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ code: string; label: string } | null>(null)
  const [deleteTranslationCount, setDeleteTranslationCount] = useState(0)
  const [pendingDeleteKeys, setPendingDeleteKeys] = useState<string[]>([])

  const saveMutation = useMutation({
    mutationFn: (updates: { key: string; langCode: string; value: string }[]) =>
      updateSheetRows(projectId!, sheetName!, updates),
  })

  const handleCellSave = (key: string, langCode: string, value: string) => {
    saveMutation.mutate([{ key, langCode, value }])
  }

  const handleAddLanguage = (code: string, label: string, translateNow: boolean) => {
    addMutation.mutate(
      { code, label },
      {
        onSuccess: () => {
          setAddModalOpen(false)
          if (translateNow) {
            trigger('translate_all')
          }
        },
      },
    )
  }

  const handleDeleteLanguage = (code: string) => {
    const lang = data?.languages.find((l) => l.code === code)
    if (lang) {
      const translationCount = data?.rows.filter((row) => row[code]).length ?? 0
      setDeleteTarget({ code, label: lang.label })
      setDeleteTranslationCount(translationCount)
    }
  }

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.code, {
        onSuccess: () => {
          setDeleteTarget(null)
        },
      })
    }
  }

  const handleDeleteRows = (keys: string[]) => {
    setPendingDeleteKeys(keys)
  }

  const handleConfirmDeleteRows = () => {
    deleteRowsMutation.mutate(pendingDeleteKeys, {
      onSuccess: () => setPendingDeleteKeys([]),
    })
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

      <DataTable
        data={data}
        disabled={isRunning}
        onCellSave={handleCellSave}
        onDeleteLanguage={handleDeleteLanguage}
        onAddLanguage={() => setAddModalOpen(true)}
        onAddRow={(key) => addRowMutation.mutate(key)}
        onDeleteRows={handleDeleteRows}
      />

      <AddLanguageModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onConfirm={handleAddLanguage}
      />

      {deleteTarget && (
        <DeleteLanguageDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          languageLabel={deleteTarget.label}
          translationCount={deleteTranslationCount}
        />
      )}

      <DeleteRowsDialog
        open={pendingDeleteKeys.length > 0}
        onClose={() => setPendingDeleteKeys([])}
        onConfirm={handleConfirmDeleteRows}
        count={pendingDeleteKeys.length}
      />
    </div>
  )
}
