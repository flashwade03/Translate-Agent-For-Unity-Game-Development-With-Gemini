import { useNavigate } from 'react-router-dom'
import { Card } from './ui/Card'
import { Badge } from './ui/Badge'
import { formatDate } from '../lib/utils'
import type { Project } from '../types'

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()
  const isGws = project.sourceType === 'gws'

  return (
    <Card
      hover
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-base">{project.name}</h3>
        <div className="flex items-center gap-1.5">
          {isGws ? (
            <Badge variant="info">Sheets</Badge>
          ) : (
            <Badge variant="default">CSV</Badge>
          )}
          <Badge variant="info">{project.sheetCount} sheets</Badge>
        </div>
      </div>
      <p className="text-sm text-text-muted mb-4 line-clamp-2">
        {project.description}
      </p>
      <div className="text-xs text-text-muted">
        Last translated: {formatDate(project.lastTranslatedAt)}
      </div>
    </Card>
  )
}
