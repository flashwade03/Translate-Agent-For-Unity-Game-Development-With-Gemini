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

export interface PendingTranslation {
  id: number
  projectId: string
  sheetName: string
  key: string
  langCode: string
  value: string
  source: 'agent' | 'user_edit'
  createdAt: string
}

export interface PendingTranslationsResponse {
  items: PendingTranslation[]
  count: number
}
