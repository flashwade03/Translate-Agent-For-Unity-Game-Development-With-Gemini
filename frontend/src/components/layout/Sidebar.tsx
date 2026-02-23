import { NavLink, useParams } from 'react-router-dom'
import { useSheetNames } from '../../hooks/useSheets'
import { cn } from '../../lib/utils'

export function Sidebar() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: sheets } = useSheetNames(projectId!)

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'block px-3 py-1.5 text-sm rounded-[var(--radius-sm)] transition-colors',
      isActive ? 'bg-accent/10 text-accent font-medium' : 'text-text-muted hover:bg-bg-muted',
    )

  return (
    <aside className="w-56 border-r border-border bg-white flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <NavLink to="/" className="text-xs text-text-muted hover:text-text">
          &larr; All Projects
        </NavLink>
        <h2 className="font-semibold mt-1 text-sm truncate">{projectId}</h2>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1 px-3">
          Sheets
        </div>
        {sheets?.map((name) => (
          <NavLink
            key={name}
            to={`/projects/${projectId}/sheets/${encodeURIComponent(name)}`}
            className={linkClass}
          >
            {name}
          </NavLink>
        ))}

        <div className="text-xs font-medium text-text-muted uppercase tracking-wide mt-4 mb-1 px-3">
          Config
        </div>
        <NavLink to={`/projects/${projectId}/glossary`} className={linkClass}>
          Glossary
        </NavLink>
        <NavLink to={`/projects/${projectId}/style-guide`} className={linkClass}>
          Style Guide
        </NavLink>
        <NavLink to={`/projects/${projectId}/reports`} className={linkClass}>
          Review Reports
        </NavLink>
      </nav>
    </aside>
  )
}
