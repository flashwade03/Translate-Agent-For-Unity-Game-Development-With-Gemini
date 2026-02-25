import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ProjectLayout } from './components/layout/ProjectLayout'
import { Spinner } from './components/ui/Spinner'
import { useSheetNames } from './hooks/useSheets'

const ProjectList = lazy(() => import('./pages/ProjectList'))
const SheetViewer = lazy(() => import('./pages/SheetViewer'))
const GlossaryEditor = lazy(() => import('./pages/GlossaryEditor'))
const StyleGuideEditor = lazy(() => import('./pages/StyleGuideEditor'))
const ReviewReport = lazy(() => import('./pages/ReviewReport'))
const JobHistory = lazy(() => import('./pages/JobHistory'))

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner />
    </div>
  )
}

function ProjectIndex() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: sheets } = useSheetNames(projectId!)

  if (sheets && sheets.length > 0) {
    return <Navigate to={`/projects/${projectId}/sheets/${encodeURIComponent(sheets[0])}`} replace />
  }

  return <div className="text-text-muted p-4">No sheets found in this project.</div>
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<ProjectList />} />
        <Route path="/projects/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectIndex />} />
          <Route path="sheets/:sheetName" element={<SheetViewer />} />
          <Route path="glossary" element={<GlossaryEditor />} />
          <Route path="style-guide" element={<StyleGuideEditor />} />
          <Route path="reports" element={<ReviewReport />} />
          <Route path="job-history" element={<JobHistory />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
