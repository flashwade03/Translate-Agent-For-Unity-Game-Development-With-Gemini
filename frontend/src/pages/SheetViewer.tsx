import { useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSheetData, useAddRow, useDeleteRows } from '../hooks/useSheets'
import { useTranslation } from '../hooks/useTranslation'
import { useLanguages } from '../hooks/useLanguages'
import { useSheetSettings, useUpdateSheetSettings } from '../hooks/useSheetSettings'
import { updateSheetRows, uploadCsv, exportCsvUrl } from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'
import type { CsvUploadResult } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { DataTable } from '../components/DataTable'
import { JobStatusBanner } from '../components/JobStatusBanner'
import { AddLanguageModal } from '../components/AddLanguageModal'
import { DeleteLanguageDialog } from '../components/DeleteLanguageDialog'
import { DeleteRowsDialog } from '../components/DeleteRowsDialog'
import { SheetSettingsDialog } from '../components/SheetSettingsDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function SheetViewer() {
  const { projectId, sheetName } = useParams<{ projectId: string; sheetName: string }>()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useSheetData(projectId!, sheetName!)
  const { job, isRunning, trigger, dismiss } = useTranslation(projectId!, sheetName!)
  const { addMutation, deleteMutation } = useLanguages(projectId!, sheetName!)
  const addRowMutation = useAddRow(projectId!, sheetName!)
  const deleteRowsMutation = useDeleteRows(projectId!, sheetName!)
  const { data: settingsData } = useSheetSettings(projectId!, sheetName!)
  const updateSettings = useUpdateSheetSettings(projectId!, sheetName!)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ code: string; label: string } | null>(null)
  const [deleteTranslationCount, setDeleteTranslationCount] = useState(0)
  const [pendingDeleteKeys, setPendingDeleteKeys] = useState<string[]>([])
  const [uploadResult, setUploadResult] = useState<CsvUploadResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadCsv(projectId!, sheetName!, file),
    onSuccess: (result) => {
      setUploadResult(result)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId!, sheetName!) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId!) })
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      uploadMutation.mutate(file)
      e.target.value = ''
    }
  }

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

  const handleToggleVisibility = (code: string) => {
    if (!data || !settingsData) return
    const current = settingsData.settings.visibleLanguages
    let next: string[]
    if (!current) {
      // Currently all visible, hide this one
      next = data.languages.map((l) => l.code).filter((c) => c !== code)
    } else if (current.includes(code)) {
      next = current.filter((c) => c !== code)
    } else {
      next = [...current, code]
    }
    // If all are visible again, set to null
    const allCodes = data.languages.map((l) => l.code)
    const newVisible = next.length >= allCodes.length ? null : next.length === 0 ? null : next
    updateSettings.mutate({ ...settingsData.settings, visibleLanguages: newVisible })
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
              size="sm"
              disabled={isRunning}
              onClick={() => trigger('translate_all')}
            >
              Translate All
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
              disabled={uploadMutation.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
            </Button>
            <a
              href={exportCsvUrl(projectId!, sheetName!)}
              download={`${sheetName}.csv`}
              className="inline-flex"
            >
              <Button variant="outline" size="sm" type="button">
                Export CSV
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </Button>
          </div>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {uploadResult && (
        <div className="mb-4 flex items-center justify-between rounded-[var(--radius-md)] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <span>
            Upload complete: {uploadResult.addedKeys} keys added, {uploadResult.updatedKeys} keys updated
            {uploadResult.addedLanguages.length > 0 && (
              <>, {uploadResult.addedLanguages.length} new language{uploadResult.addedLanguages.length > 1 ? 's' : ''} added</>
            )}
          </span>
          <button
            className="ml-4 text-green-600 hover:text-green-800"
            onClick={() => setUploadResult(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="mb-4 flex items-center justify-between rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Upload failed: {uploadMutation.error?.message ?? 'Unknown error'}</span>
          <button
            className="ml-4 text-red-600 hover:text-red-800"
            onClick={() => uploadMutation.reset()}
          >
            Dismiss
          </button>
        </div>
      )}

      {job && <JobStatusBanner job={job} onDismiss={dismiss} />}

      <DataTable
        data={data}
        disabled={isRunning}
        visibleLanguages={settingsData?.settings.visibleLanguages}
        onCellSave={handleCellSave}
        onDeleteLanguage={handleDeleteLanguage}
        onAddLanguage={() => setAddModalOpen(true)}
        onAddRow={(key) => addRowMutation.mutate(key)}
        onDeleteRows={handleDeleteRows}
        onToggleVisibility={handleToggleVisibility}
      />

      <AddLanguageModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onConfirm={handleAddLanguage}
        projectId={projectId!}
        existingCodes={data.languages.map((l) => l.code)}
      />

      {deleteTarget && (
        <DeleteLanguageDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          languageLabel={deleteTarget.label}
          languageCode={deleteTarget.code}
          translationCount={deleteTranslationCount}
        />
      )}

      <DeleteRowsDialog
        open={pendingDeleteKeys.length > 0}
        onClose={() => setPendingDeleteKeys([])}
        onConfirm={handleConfirmDeleteRows}
        count={pendingDeleteKeys.length}
      />

      <SheetSettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        projectId={projectId!}
        sheetName={sheetName!}
      />
    </div>
  )
}
