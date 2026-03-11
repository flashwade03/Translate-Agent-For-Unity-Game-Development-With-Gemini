import { useState } from 'react'
import { NavLink, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSheetNames, useSheetData, useCreateSheet, useDeleteSheet } from '../../hooks/useSheets'
import { uploadCsv } from '../../api/sheets'
import { fetchProject } from '../../api/projects'
import { QUERY_KEYS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { AddSheetDialog } from '../AddSheetDialog'
import { DeleteSheetDialog } from '../DeleteSheetDialog'

export function Sidebar() {
  const { projectId, sheetName } = useParams<{ projectId: string; sheetName: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sheets } = useSheetNames(projectId!)
  const createSheet = useCreateSheet(projectId!)
  const deleteSheet = useDeleteSheet(projectId!)

  // Detect project sourceType
  const { data: project } = useQuery({
    queryKey: QUERY_KEYS.project(projectId!),
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  })
  const isGws = project?.sourceType === 'gws'

  const importSheet = useMutation({
    mutationFn: ({ name, file }: { name: string; file: File }) =>
      createSheet.mutateAsync(name).then(() => uploadCsv(projectId!, name, file)),
    onSuccess: (_result, { name }) => {
      setAddOpen(false)
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId!, name) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projectLanguages(projectId!) })
      navigate(`/projects/${projectId}/sheets/${encodeURIComponent(name)}`)
    },
  })

  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Get key count for the sheet being deleted
  const { data: deleteSheetData } = useSheetData(
    projectId!,
    deleteTarget || '',
  )

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center justify-between px-3 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors group',
      isActive ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-bg-muted',
    )

  const configLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-3 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors',
      isActive ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-bg-muted',
    )

  const handleCreate = (name: string) => {
    createSheet.mutate(name, {
      onSuccess: () => {
        setAddOpen(false)
        navigate(`/projects/${projectId}/sheets/${encodeURIComponent(name)}`)
      },
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteSheet.mutate(deleteTarget, {
      onSuccess: () => {
        setDeleteTarget(null)
        // Navigate away if we deleted the current sheet
        if (sheetName === deleteTarget) {
          navigate(`/projects/${projectId}`)
        }
      },
    })
  }

  return (
    <aside className="w-56 border-r border-border bg-white flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <NavLink to="/" className="text-xs text-text-muted hover:text-text">
          &larr; All Projects
        </NavLink>
        <div className="flex items-center gap-2 mt-1">
          <h2 className="font-semibold text-sm truncate">{projectId}</h2>
          {isGws && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-50 text-blue-600">
              Sheets
            </span>
          )}
        </div>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        <div className="flex items-center justify-between mb-1 px-3">
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
            Sheets
          </span>
          {/* Hide add sheet button for gws projects */}
          {!isGws && (
            <button
              onClick={() => setAddOpen(true)}
              className="text-text-muted hover:text-accent transition-colors"
              title="Add sheet"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}
        </div>
        {sheets?.map((name) => (
          <NavLink
            key={name}
            to={`/projects/${projectId}/sheets/${encodeURIComponent(name)}`}
            className={linkClass}
          >
            <span className="truncate">{name}</span>
            {/* Hide delete button for gws projects */}
            {!isGws && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDeleteTarget(name)
                }}
                className="hidden group-hover:block text-text-muted hover:text-red-500 transition-colors shrink-0 ml-1"
                title={`Delete ${name}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </NavLink>
        ))}

        <div className="text-xs font-medium text-text-muted uppercase tracking-wide mt-4 mb-1 px-3">
          Config
        </div>
        <NavLink to={`/projects/${projectId}/languages`} className={configLinkClass}>
          Languages
        </NavLink>
        <NavLink to={`/projects/${projectId}/glossary`} className={configLinkClass}>
          Glossary
        </NavLink>
        <NavLink to={`/projects/${projectId}/style-guide`} className={configLinkClass}>
          Style Guide
        </NavLink>
        <NavLink to={`/projects/${projectId}/reports`} className={configLinkClass}>
          Review Reports
        </NavLink>
        <NavLink to={`/projects/${projectId}/job-history`} className={configLinkClass}>
          Job History
        </NavLink>
      </nav>

      {!isGws && (
        <AddSheetDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={handleCreate}
          onImport={(name, file) => importSheet.mutate({ name, file })}
          isPending={createSheet.isPending || importSheet.isPending}
        />
      )}

      {!isGws && deleteTarget && (
        <DeleteSheetDialog
          open={!!deleteTarget}
          sheetName={deleteTarget}
          keyCount={deleteSheetData?.rows.length ?? 0}
          onClose={() => setDeleteTarget(null)}
          onDelete={handleDelete}
          isPending={deleteSheet.isPending}
        />
      )}
    </aside>
  )
}
