export type JobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type JobType = 'translate_all' | 'update' | 'review'

export interface TranslationJob {
  jobId: string
  projectId: string
  sheetName: string
  type: JobType
  status: JobStatus
  progress: number
  totalKeys: number
  processedKeys: number
  error?: string
  createdAt: string
}

export interface JobHistoryEntry {
  jobId: string
  projectId: string
  sheetName: string
  type: JobType
  status: JobStatus
  totalKeys: number
  processedKeys: number
  error?: string
  createdAt: string
  completedAt?: string
}
