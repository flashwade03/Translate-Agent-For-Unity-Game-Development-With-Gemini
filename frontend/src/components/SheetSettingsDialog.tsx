import { useState, useEffect } from 'react'
import { useSheetSettings, useUpdateSheetSettings } from '../hooks/useSheetSettings'
import { useProjectLanguages } from '../hooks/useProjectLanguages'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Button } from './ui/Button'
import { Spinner } from './ui/Spinner'
import type { SheetSettings } from '../types'

interface SheetSettingsDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  sheetName: string
}

export function SheetSettingsDialog({ open, onClose, projectId, sheetName }: SheetSettingsDialogProps) {
  const { data, isLoading } = useSheetSettings(projectId, sheetName)
  const updateMutation = useUpdateSheetSettings(projectId, sheetName)
  const { data: projectLangs } = useProjectLanguages(projectId)

  const [form, setForm] = useState<SheetSettings>({
    sourceLanguage: null,
    translationStyle: null,
    characterLimit: null,
    glossaryOverride: null,
    instructions: null,
    visibleLanguages: null,
  })

  useEffect(() => {
    if (data) setForm(data.settings)
  }, [data])

  const defaults = data?.projectDefaults

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Convert empty strings to null (= use project default)
    const payload: SheetSettings = {
      sourceLanguage: form.sourceLanguage || null,
      translationStyle: form.translationStyle || null,
      characterLimit: form.characterLimit,
      glossaryOverride: form.glossaryOverride || null,
      instructions: form.instructions || null,
      visibleLanguages: form.visibleLanguages,
    }
    updateMutation.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Modal open={open} onClose={onClose} title={`${sheetName} Settings`} maxWidth="max-w-lg">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--foreground)]">Source Language</label>
            <div className="relative">
              <select
                value={form.sourceLanguage ?? ''}
                onChange={(e) => setForm({ ...form, sourceLanguage: e.target.value || null })}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-[var(--radius-md)] text-sm bg-white appearance-none pr-8 outline-none focus:ring-1 focus:ring-accent/30 focus:border-accent"
              >
                <option value="">
                  {defaults?.sourceLanguage
                    ? `${projectLangs?.find((l) => l.code === defaults.sourceLanguage)?.label ?? defaults.sourceLanguage} (${defaults.sourceLanguage}) — project default`
                    : 'Select source language...'}
                </option>
                {projectLangs?.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label} ({lang.code})
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <Input
            label="Translation Style"
            value={form.translationStyle ?? ''}
            onChange={(e) => setForm({ ...form, translationStyle: e.target.value || null })}
            placeholder={defaults?.translationStyle || 'e.g. formal, casual, playful...'}
          />

          <Input
            label="Character Limit"
            type="number"
            value={form.characterLimit ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                characterLimit: e.target.value ? Number(e.target.value) : null,
              })
            }
            placeholder={defaults?.characterLimit != null ? String(defaults.characterLimit) : '0 (no limit)'}
          />

          <div className="flex flex-col gap-1.5">
            <Textarea
              label="Glossary Override"
              value={form.glossaryOverride ?? ''}
              onChange={(e) => setForm({ ...form, glossaryOverride: e.target.value || null })}
              placeholder="source_term → translated_term (one per line)"
              rows={3}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Additional term pairs that override project glossary for this sheet only.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Textarea
              label="Custom Instructions"
              value={form.instructions ?? ''}
              onChange={(e) => setForm({ ...form, instructions: e.target.value || null })}
              placeholder={defaults?.instructions || 'e.g. This sheet contains UI button labels. Keep translations short and action-oriented.'}
              rows={4}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              Free-form instructions for the translator agent when processing this sheet.
            </p>
          </div>

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
