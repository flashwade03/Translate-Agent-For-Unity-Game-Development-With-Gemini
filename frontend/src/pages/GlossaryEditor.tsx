import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  useGlossary,
  useAddGlossaryEntry,
  useUpdateGlossaryEntry,
  useDeleteGlossaryEntry,
} from '../hooks/useGlossary'
import { useProjectLanguages } from '../hooks/useProjectLanguages'
import { PageHeader } from '../components/layout/PageHeader'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Spinner } from '../components/ui/Spinner'
import type { GlossaryEntry } from '../types'

function AddTermModal({
  open,
  onClose,
  onAdd,
  projectId,
}: {
  open: boolean
  onClose: () => void
  onAdd: (entry: Omit<GlossaryEntry, 'id'>) => void
  projectId: string
}) {
  const { data: projectLangs } = useProjectLanguages(projectId)
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [language, setLanguage] = useState('')
  const [context, setContext] = useState('')

  const handleSubmit = () => {
    if (!source || !target || !language) return
    onAdd({ source, target, language, context: context || undefined })
    setSource('')
    setTarget('')
    setContext('')
    onClose()
  }

  const handleClose = () => {
    setSource('')
    setTarget('')
    setLanguage('')
    setContext('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add Term">
      <div className="flex flex-col gap-4">
        <Input label="Source Term" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g., Health Potion" required />
        <Input label="Target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g., 回復ポーション" required />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-[var(--radius-sm)] outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-white"
          >
            <option value="">Select a language...</option>
            {(projectLangs ?? []).map((l) => (
              <option key={l.code} value={l.code}>{l.label} ({l.code})</option>
            ))}
          </select>
        </div>
        <Input label="Context" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Optional context" />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={!source || !target || !language}>Add Term</Button>
        </div>
      </div>
    </Modal>
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
            <Button size="sm" variant="ghost" onClick={() => onDelete(entry.id)} className="text-error">Delete</Button>
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
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-accent hover:text-accent/80 cursor-pointer font-medium"
        >
          Edit
        </button>
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
  const [addOpen, setAddOpen] = useState(false)

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
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add Term
          </Button>
        }
      />

      <div className="mb-3">
        <Input
          placeholder="Search terms..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-[var(--radius-md)] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-muted">
              <th className="text-left px-3 py-2 font-medium text-text-muted">Source Term</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Translation</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Lang</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted">Context</th>
              <th className="text-left px-3 py-2 font-medium text-text-muted w-20">Actions</th>
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

      <AddTermModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(entry) => addMutation.mutate(entry)}
        projectId={projectId!}
      />
    </div>
  )
}
