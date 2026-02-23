import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useGlossary,
  useAddGlossaryEntry,
  useUpdateGlossaryEntry,
  useDeleteGlossaryEntry,
} from '../hooks/useGlossary'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import type { GlossaryEntry } from '../types'

function AddEntryForm({ onAdd }: { onAdd: (entry: Omit<GlossaryEntry, 'id'>) => void }) {
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [language, setLanguage] = useState('')
  const [context, setContext] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!source || !target || !language) return
    onAdd({ source, target, language, context: context || undefined })
    setSource('')
    setTarget('')
    setContext('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2 mb-4 flex-wrap">
      <div className="flex-1 min-w-[120px]">
        <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Level Up" required />
      </div>
      <div className="flex-1 min-w-[120px]">
        <Input label="Target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="レベルアップ" required />
      </div>
      <div className="w-20">
        <Input label="Lang" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="ja" required />
      </div>
      <div className="flex-1 min-w-[120px]">
        <Input label="Context" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Optional" />
      </div>
      <Button type="submit" size="sm">Add</Button>
    </form>
  )
}

function GlossaryRow({
  entry,
  onUpdate,
  onDelete,
}: {
  entry: GlossaryEntry
  onUpdate: (id: string, data: Partial<GlossaryEntry>) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [source, setSource] = useState(entry.source)
  const [target, setTarget] = useState(entry.target)
  const [context, setContext] = useState(entry.context || '')

  const handleSave = () => {
    onUpdate(entry.id, { source, target, context: context || undefined })
    setEditing(false)
  }

  if (editing) {
    return (
      <tr className="border-b border-border">
        <td className="px-3 py-1.5">
          <input className="w-full px-2 py-1 text-sm border border-border rounded-[var(--radius-sm)]" value={source} onChange={(e) => setSource(e.target.value)} />
        </td>
        <td className="px-3 py-1.5">
          <input className="w-full px-2 py-1 text-sm border border-border rounded-[var(--radius-sm)]" value={target} onChange={(e) => setTarget(e.target.value)} />
        </td>
        <td className="px-3 py-1.5 text-sm">{entry.language}</td>
        <td className="px-3 py-1.5">
          <input className="w-full px-2 py-1 text-sm border border-border rounded-[var(--radius-sm)]" value={context} onChange={(e) => setContext(e.target.value)} />
        </td>
        <td className="px-3 py-1.5">
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-muted/50">
      <td className="px-3 py-2 text-sm">{entry.source}</td>
      <td className="px-3 py-2 text-sm">{entry.target}</td>
      <td className="px-3 py-2 text-sm text-text-muted">{entry.language}</td>
      <td className="px-3 py-2 text-sm text-text-muted">{entry.context || '-'}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(entry.id)} className="text-error">Delete</Button>
        </div>
      </td>
    </tr>
  )
}

export default function GlossaryEditor() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data, isLoading } = useGlossary(projectId!)
  const addMutation = useAddGlossaryEntry(projectId!)
  const updateMutation = useUpdateGlossaryEntry(projectId!)
  const deleteMutation = useDeleteGlossaryEntry(projectId!)
  const [search, setSearch] = useState('')

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }

  const entries = data?.entries || []
  const filtered = search
    ? entries.filter(
        (e) =>
          e.source.toLowerCase().includes(search.toLowerCase()) ||
          e.target.toLowerCase().includes(search.toLowerCase()),
      )
    : entries

  return (
    <div>
      <PageHeader
        title="Glossary"
        description={`${entries.length} entries`}
      />

      <AddEntryForm onAdd={(entry) => addMutation.mutate(entry)} />

      <div className="mb-3">
        <Input
          placeholder="Search glossary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-[var(--radius-md)] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-muted">
              <th className="text-left px-3 py-2 font-medium text-text-muted">Source</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Target</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Lang</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Context</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted w-32">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <GlossaryRow
                key={entry.id}
                entry={entry}
                onUpdate={(id, data) => updateMutation.mutate({ entryId: id, data })}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-text-muted">
                  {search ? 'No matching entries.' : 'No glossary entries yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
