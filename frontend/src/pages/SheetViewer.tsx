import { useState, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSheetData, useAddRow, useDeleteRows } from '../hooks/useSheets'
import { useTranslation } from '../hooks/useTranslation'
import { useLanguages } from '../hooks/useLanguages'
import { useSheetSettings, useUpdateSheetSettings } from '../hooks/useSheetSettings'
import {
  usePendingTranslations,
  usePendingCount,
  useApplyTranslations,
  useDiscardPending,
  useSavePending,
} from '../hooks/usePendingTranslations'
import { updateSheetRows, uploadCsv, exportCsvUrl } from '../api/sheets'
import { fetchProject } from '../api/projects'
import { QUERY_KEYS } from '../lib/constants'
import type { CsvUploadResult, SheetData } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { DataTable } from '../components/DataTable'
import { JobStatusBanner } from '../components/JobStatusBanner'
import { ApplyBar } from '../components/ApplyBar'
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

  // 4.5a: Detect project sourceType
  const { data: project } = useQuery({
    queryKey: QUERY_KEYS.project(projectId!),
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  })
  const isGws = project?.sourceType === 'gws'

  // 4.5b/4.5c: Pending translations for gws projects
  const { data: pendingData } = usePendingTranslations(projectId!, sheetName!, isGws)
  const { data: pendingCountData } = usePendingCount(projectId!, sheetName!, isGws)
  const applyMutation = useApplyTranslations(projectId!, sheetName!)
  const discardMutation = useDiscardPending(projectId!, sheetName!)
  const savePendingMutation = useSavePending(projectId!, sheetName!)

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

  // 4.5b: gws cell edit -> save to pending; csv -> immediate save
  const handleCellSave = (key: string, langCode: string, value: string) => {
    if (isGws) {
      savePendingMutation.mutate([{ key, langCode, value }])
    } else {
      saveMutation.mutate([{ key, langCode, value }])
    }
  }

  // 4.5c: Client-side merge of base data + pending overrides
  const pendingOverrides = useMemo(() => {
    if (!isGws || !pendingData?.items) return undefined
    const overrides: Record<string, Record<string, string>> = {}
    for (const item of pendingData.items) {
      if (!overrides[item.key]) overrides[item.key] = {}
      overrides[item.key][item.langCode] = item.value
    }
    return overrides
  }, [isGws, pendingData])

  const mergedData = useMemo((): SheetData | undefined => {
    if (!data) return undefined
    if (!pendingOverrides) return data
    const mergedRows = data.rows.map((row) => {
      const overrides = pendingOverrides[row.key]
      if (!overrides) return row
      return { ...row, ...overrides }
    })
    return { ...data, rows: mergedRows }
  }, [data, pendingOverrides])

  // Base rows lookup for diff display
  const baseRowsLookup = useMemo(() => {
    if (!isGws || !data?.rows) return undefined
    const lookup: Record<string, Record<string, string>> = {}
    for (const row of data.rows) {
      lookup[row.key] = {}
      for (const [k, v] of Object.entries(row)) {
        if (k !== 'key') lookup[row.key][k] = v
      }
    }
    return lookup
  }, [isGws, data])

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

  if (error || !data || !mergedData) {
    return <div className="text-error py-8">Failed to load sheet data.</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
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
              {/* 4.5d: Hide Upload CSV for gws projects */}
              {!isGws && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
                </Button>
              )}
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

        {!isGws && (
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
        )}

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
          data={mergedData}
          disabled={isRunning}
          visibleLanguages={settingsData?.settings.visibleLanguages}
          pendingCells={pendingOverrides}
          baseRows={baseRowsLookup}
          hideCheckboxes={isGws}
          hideAddRow={isGws}
          onCellSave={handleCellSave}
          onDeleteLanguage={handleDeleteLanguage}
          onAddLanguage={() => setAddModalOpen(true)}
          onAddRow={isGws ? undefined : (key) => addRowMutation.mutate(key)}
          onDeleteRows={isGws ? undefined : handleDeleteRows}
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

      {/* 4.5: ApplyBar at bottom for gws projects */}
      {isGws && (
        <ApplyBar
          pendingCount={pendingCountData?.count ?? 0}
          onApply={() => applyMutation.mutate()}
          onDiscard={() => discardMutation.mutate()}
          isApplying={applyMutation.isPending}
          applyError={applyMutation.isError ? applyMutation.error.message : undefined}
        />
      )}
    </div>
  )
}
