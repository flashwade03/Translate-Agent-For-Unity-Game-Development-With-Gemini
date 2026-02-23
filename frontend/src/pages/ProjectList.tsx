import { useState } from 'react'
import { useProjects } from '../hooks/useProjects'
import { ProjectCard } from '../components/ProjectCard'
import { CreateProjectModal } from '../components/CreateProjectModal'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function ProjectList() {
  const { data: projects, isLoading, error } = useProjects()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="min-h-screen bg-bg-muted">
      <header className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">Game Translation Agent</h1>
          <Button onClick={() => setShowCreate(true)}>+ New Project</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        )}

        {error && (
          <div className="text-center py-20 text-error">
            Failed to load projects.
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="text-center py-20 text-text-muted">
            <p className="mb-4">No projects yet.</p>
            <Button onClick={() => setShowCreate(true)}>Create your first project</Button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
