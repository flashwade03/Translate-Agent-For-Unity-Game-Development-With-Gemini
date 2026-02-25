import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useStyleGuide, useUpdateStyleGuide } from '../hooks/useStyleGuide'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import type { StyleGuide } from '../types'

export default function StyleGuideEditor() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data, isLoading } = useStyleGuide(projectId!)
  const updateMutation = useUpdateStyleGuide(projectId!)

  const [form, setForm] = useState<StyleGuide>({
    projectId: projectId!,
    tone: '',
    formality: 'neutral',
    audience: '',
    rules: '',
    examples: '',
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(form, {
      onSuccess: () => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
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
      <form onSubmit={handleSubmit}>
        <PageHeader
          title="Style Guide"
          description="Define the translation tone and style for this project."
          actions={
            <div className="flex items-center gap-3">
              {saved && <span className="text-sm text-success">Saved!</span>}
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-4">
          <Input
            label="Tone"
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            placeholder="e.g., Friendly and encouraging"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text">Formality Level</label>
            <select
              value={form.formality}
              onChange={(e) => setForm({ ...form, formality: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-border rounded-[var(--radius-sm)] outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
            >
              <option value="casual">Casual</option>
              <option value="neutral">Neutral</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <Input
            label="Target Audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
            placeholder="e.g., Young adults (18-30)"
          />

          <Textarea
            label="Translation Notes"
            value={form.rules}
            onChange={(e) => setForm({ ...form, rules: e.target.value })}
            placeholder="- Use simple language&#10;- Keep exclamations for achievements"
            rows={6}
          />

          <Textarea
            label="Style Examples"
            value={form.examples}
            onChange={(e) => setForm({ ...form, examples: e.target.value })}
            placeholder='Good: "Awesome job!"&#10;Bad: "Your performance metrics..."'
            rows={4}
          />
        </div>
      </form>
    </div>
  )
}
