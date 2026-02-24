import { api } from './client'
import type { JobHistoryEntry } from '../types'

export function fetchJobHistory(projectId: string) {
  return api<JobHistoryEntry[]>('GET', `/api/projects/${projectId}/jobs`)
}
