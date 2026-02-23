import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSheetSettings, useUpdateSheetSettings } from '../hooks/useSheetSettings'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import type { SheetSettings as SheetSettingsType } from '../types'

export default function SheetSettings() {
  const { projectId, sheetName } = useParams<{ projectId: string; sheetName: string }>()
  const navigate = useNavigate()
  const { data, isLoading } = useSheetSettings(projectId!, sheetName!)
  const updateMutation = useUpdateSheetSettings(projectId!, sheetName!)

  const [form, setForm] = useState<SheetSettingsType>({
    projectId: projectId!,
    sheetName: sheetName!,
    sourceLanguage: 'en',
    translationStyle: 'casual',
    characterLimit: null,
    glossaryOverride: false,
    instructions: '',
  })

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form, {
      onSuccess: () => {
        navigate(`/projects/${projectId}/sheets/${encodeURIComponent(sheetName!)}`)
      },
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
    <div className="max-w-lg">
      <PageHeader title={`${sheetName} Settings`} />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Source Language"
          value={form.sourceLanguage}
          onChange={(e) => setForm({ ...form, sourceLanguage: e.target.value })}
          placeholder="en"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Translation Style</label>
          <select
            value={form.translationStyle}
            onChange={(e) => setForm({ ...form, translationStyle: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-border rounded-[var(--radius-sm)] outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
          >
            <option value="casual">Casual</option>
            <option value="formal">Formal</option>
            <option value="playful">Playful</option>
            <option value="technical">Technical</option>
          </select>
        </div>

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
          placeholder="No limit"
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.glossaryOverride}
            onChange={(e) => setForm({ ...form, glossaryOverride: e.target.checked })}
            className="rounded"
          />
          Override project glossary for this sheet
        </label>

        <Textarea
          label="Additional Instructions"
          value={form.instructions}
          onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          placeholder="Extra context or instructions for the translator agent..."
          rows={4}
        />

        <div className="flex gap-2 mt-2">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              navigate(`/projects/${projectId}/sheets/${encodeURIComponent(sheetName!)}`)
            }
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
