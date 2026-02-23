import { api } from './client'
import type { TranslationJob, JobType } from '../types'

export function triggerJob(projectId: string, sheetName: string, type: JobType) {
  return api<TranslationJob>(
    'POST',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/jobs`,
    { type },
  )
}

export function pollJob(jobId: string) {
  return api<TranslationJob>('GET', `/api/jobs/${jobId}`)
}
