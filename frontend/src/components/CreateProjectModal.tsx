import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Button } from './ui/Button'
import { useCreateProject } from '../hooks/useProjects'
import { fetchGwsAuthStatus } from '../api/gws'
import { QUERY_KEYS } from '../lib/constants'
import type { SourceType } from '../types'

type Tab = 'csv' | 'gws'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [tab, setTab] = useState<Tab>('csv')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [spreadsheetId, setSpreadsheetId] = useState('')
  const mutation = useCreateProject()

  const { data: authStatus } = useQuery({
    queryKey: QUERY_KEYS.gwsAuthStatus,
    queryFn: fetchGwsAuthStatus,
    enabled: open && tab === 'gws',
    staleTime: 30_000,
  })

  useEffect(() => {
    if (open) {
      setTab('csv')
      setName('')
      setDescription('')
      setSpreadsheetId('')
    }
  }, [open])

  const sourceType: SourceType = tab

  const canSubmit =
    name.trim().length > 0 &&
    (tab === 'csv' || spreadsheetId.trim().length > 0)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      {
        name,
        description,
        sourceType,
        spreadsheetId: tab === 'gws' ? spreadsheetId.trim() : undefined,
      },
      {
        onSuccess: () => {
          setName('')
          setDescription('')
          setSpreadsheetId('')
          onClose()
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Tab bar */}
        <div className="flex gap-1 rounded-[var(--radius-md)] bg-bg-muted p-1">
          <button
            type="button"
            className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'csv'
                ? 'bg-bg-base border border-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setTab('csv')}
          >
            Local CSV
          </button>
          <button
            type="button"
            className={`flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === 'gws'
                ? 'bg-bg-base border border-border shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
            onClick={() => setTab('gws')}
          >
            Google Sheets
          </button>
        </div>

        {/* GWS auth status warnings */}
        {tab === 'gws' && authStatus && !authStatus.cliInstalled && (
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>gws CLI is not installed</strong> on the server. Install it to use Google Sheets integration.
          </div>
        )}
        {tab === 'gws' && authStatus && authStatus.cliInstalled && !authStatus.authenticated && (
          <div className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <strong>gws CLI is not authenticated.</strong>{' '}
            Run <code className="bg-amber-100 px-1 rounded text-xs">gws auth login --scopes sheets</code> on the server.
          </div>
        )}

        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Game"
          required
          autoFocus
        />

        {tab === 'csv' && (
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the project"
          />
        )}

        {tab === 'gws' && (
          <>
            <Input
              label="Spreadsheet ID"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
              required
            />
            <p className="text-xs text-text-muted -mt-2">
              The ID from the Google Sheets URL: docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit
            </p>
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the project"
            />
          </>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
