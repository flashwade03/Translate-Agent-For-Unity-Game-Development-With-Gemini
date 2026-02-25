import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProjectLanguages, useAddProjectLanguage, useDeleteProjectLanguage } from '../hooks/useProjectLanguages'
import { PageHeader } from '../components/layout/PageHeader'
import { DeleteProjectLanguageDialog } from '../components/DeleteProjectLanguageDialog'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { TIER1_PRESETS, TIER2_PRESETS } from '../lib/localePresets'
import type { ProjectLanguage } from '../types'

export default function LanguageSettings() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: languages, isLoading } = useProjectLanguages(projectId!)
  const addMutation = useAddProjectLanguage(projectId!)
  const deleteMutation = useDeleteProjectLanguage(projectId!)

  const [customCode, setCustomCode] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ProjectLanguage | null>(null)

  const existingCodes = new Set(languages?.map((l) => l.code) ?? [])

  const handleAddPreset = (preset: ProjectLanguage) => {
    if (existingCodes.has(preset.code)) return
    addMutation.mutate({ code: preset.code, label: preset.label })
  }

  const handleAddAllPresets = (presets: ProjectLanguage[]) => {
    const toAdd = presets.filter((p) => !existingCodes.has(p.code))
    // Add sequentially
    toAdd.reduce(
      (promise, p) =>
        promise.then(
          () =>
            new Promise<void>((resolve) => {
              addMutation.mutate({ code: p.code, label: p.label }, { onSettled: () => resolve() })
            }),
        ),
      Promise.resolve(),
    )
  }

  const handleAddCustom = () => {
    const code = customCode.trim()
    const label = customLabel.trim()
    if (!code || !label) return
    addMutation.mutate(
      { code, label },
      {
        onSuccess: () => {
          setCustomCode('')
          setCustomLabel('')
        },
      },
    )
  }

  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    deleteMutation.mutate(deleteTarget.code, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

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
        title="Languages"
        description="Manage the languages this project supports. These define the columns in all sheet CSVs."
      />

      {/* Quick Add Presets */}
      <div className="border border-[var(--border)] rounded-[var(--radius-lg)] p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Quick Add Presets</h3>

        {/* Tier 1 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Tier 1 · EFIGS + CJK (10 languages)
            </span>
            <button
              onClick={() => handleAddAllPresets(TIER1_PRESETS)}
              className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium cursor-pointer"
            >
              Add All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIER1_PRESETS.map((preset) => {
              const added = existingCodes.has(preset.code)
              return (
                <button
                  key={preset.code}
                  onClick={() => handleAddPreset(preset)}
                  disabled={added || addMutation.isPending}
                  className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                    added
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] font-medium'
                      : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                  } disabled:opacity-60 disabled:cursor-default`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tier 2 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
              Tier 2 · Extended (8 languages)
            </span>
            <button
              onClick={() => handleAddAllPresets(TIER2_PRESETS)}
              className="text-xs text-[var(--primary)] hover:text-[var(--primary)]/80 font-medium cursor-pointer"
            >
              Add All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIER2_PRESETS.map((preset) => {
              const added = existingCodes.has(preset.code)
              return (
                <button
                  key={preset.code}
                  onClick={() => handleAddPreset(preset)}
                  disabled={added || addMutation.isPending}
                  className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                    added
                      ? 'bg-[var(--primary-light)] text-[var(--primary)] font-medium'
                      : 'border border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                  } disabled:opacity-60 disabled:cursor-default`}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Custom Language */}
      <div className="border border-[var(--border)] rounded-[var(--radius-lg)] p-5 mb-6">
        <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Custom Language</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Locale Code
            </label>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              placeholder="e.g., fil"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-[var(--radius-md)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]/50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="e.g., Filipino"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-[var(--radius-md)] outline-none focus:ring-1 focus:ring-[var(--primary)]/30 focus:border-[var(--primary)] placeholder:text-[var(--muted-foreground)]/50"
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddCustom}
            disabled={!customCode.trim() || !customLabel.trim() || addMutation.isPending}
          >
            Add
          </Button>
        </div>
      </div>

      {/* Languages Table */}
      {languages && languages.length > 0 && (
        <div className="border border-[var(--border)] rounded-[var(--radius-lg)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--sidebar-bg)]">
                <th className="text-left px-4 py-2.5 font-medium text-[var(--muted-foreground)]">Language</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--muted-foreground)]">Code</th>
                <th className="text-left px-4 py-2.5 font-medium text-[var(--muted-foreground)]">CSV Header</th>
                <th className="w-12 px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.code} className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--sidebar-bg)]/50">
                  <td className="px-4 py-2.5 text-[var(--foreground)]">{lang.label}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{lang.code}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">
                    {lang.label}({lang.code})
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setDeleteTarget(lang)}
                      className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors cursor-pointer"
                      title={`Delete ${lang.label}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteProjectLanguageDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          languageLabel={deleteTarget.label}
          isPending={deleteMutation.isPending}
        />
      )}
    </div>
  )
}
