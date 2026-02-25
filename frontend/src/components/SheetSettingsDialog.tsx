import { useState, useEffect } from 'react'
import { useSheetSettings, useUpdateSheetSettings } from '../hooks/useSheetSettings'
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

  const [form, setForm] = useState<SheetSettings>({
    sourceLanguage: null,
    translationStyle: null,
    characterLimit: null,
    glossaryOverride: null,
    instructions: null,
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
          <Input
            label="Source Language"
            value={form.sourceLanguage ?? ''}
            onChange={(e) => setForm({ ...form, sourceLanguage: e.target.value || null })}
            placeholder={defaults?.sourceLanguage ?? 'en'}
          />

          <Input
            label="Translation Style"
            value={form.translationStyle ?? ''}
            onChange={(e) => setForm({ ...form, translationStyle: e.target.value || null })}
            placeholder={defaults?.translationStyle || 'e.g. casual, formal, playful'}
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
            placeholder={defaults?.characterLimit != null ? String(defaults.characterLimit) : 'No limit'}
          />

          <Textarea
            label="Glossary Override"
            value={form.glossaryOverride ?? ''}
            onChange={(e) => setForm({ ...form, glossaryOverride: e.target.value || null })}
            placeholder="source_term → translated_term (one per line)"
            rows={3}
          />

          <Textarea
            label="Custom Instructions"
            value={form.instructions ?? ''}
            onChange={(e) => setForm({ ...form, instructions: e.target.value || null })}
            placeholder={defaults?.instructions || 'Extra context or instructions for the translator agent...'}
            rows={4}
          />

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
