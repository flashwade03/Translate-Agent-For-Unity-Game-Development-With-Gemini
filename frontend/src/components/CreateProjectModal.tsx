import { useState } from 'react'
import { Modal } from './ui/Modal'
import { Input } from './ui/Input'
import { Textarea } from './ui/Textarea'
import { Button } from './ui/Button'
import { useCreateProject } from '../hooks/useProjects'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const mutation = useCreateProject()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      { name, description },
      {
        onSuccess: () => {
          setName('')
          setDescription('')
          onClose()
        },
      },
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="New Project">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Game"
          required
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of the project"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
